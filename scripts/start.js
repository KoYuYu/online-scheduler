const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const port = process.env.PORT || "3000";
const localDataPath = process.env.LOCAL_DATA_PATH || path.join(os.tmpdir(), "online-scheduler", "scheduler.json");
const standaloneServer = path.join(process.cwd(), ".next", "standalone", "server.js");
const args = fs.existsSync(standaloneServer)
  ? [standaloneServer]
  : ["node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", port];

async function verifyDatabase() {
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL is not set; using local JSON storage fallback.");
    return;
  }

  const { Pool } = require("pg");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
  });

  try {
    await pool.query("SELECT 1");
    console.log("Postgres connection verified.");
  } finally {
    await pool.end();
  }
}

function spawnServer(scriptPath, env) {
  return new Promise((resolve, reject) => {
    console.log(`[start] Spawning server: ${process.execPath} ${scriptPath}`);
    console.log(`[start] Environment passed to child: PORT=${env.PORT}, HOSTNAME=${env.HOSTNAME}, LOCAL_DATA_PATH=${env.LOCAL_DATA_PATH}, DATABASE_URL=${env.DATABASE_URL ? "(set)" : "(not set)"}`);

    const child = spawn(process.execPath, [scriptPath], {
      stdio: "inherit",
      env,
    });

    console.log(`[start] Child process spawned with PID ${child.pid}`);

    child.on("error", (error) => {
      console.error(`[start] Child process error: ${error.message}`);
      reject(new Error(`Failed to spawn server process: ${error.message}`));
    });

    child.on("exit", (code, signal) => {
      if (signal) {
        console.error(`[start] Child process killed by signal: ${signal}`);
        process.kill(process.pid, signal);
      } else {
        console.error(`[start] Child process exited with code: ${code}`);
        process.exit(code ?? 1);
      }
    });

    // Propagate termination signals to the child process.
    for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
      process.on(sig, () => child.kill(sig));
    }

    // Resolve once the child is running so main() can return while the
    // child process keeps the event loop alive.
    resolve();
  });
}

async function main() {
  await verifyDatabase();

  const env = {
    ...process.env,
    PORT: port,
    HOSTNAME: process.env.HOSTNAME || "0.0.0.0",
    LOCAL_DATA_PATH: localDataPath,
  };

  const standaloneExists = fs.existsSync(standaloneServer);
  console.log(`[start] Standalone server path: ${standaloneServer}`);
  console.log(`[start] Standalone server exists: ${standaloneExists}`);

  const serverScript = standaloneExists
    ? standaloneServer
    : path.join(process.cwd(), args[0]);

  console.log(`[start] Resolved server script: ${serverScript}`);

  await spawnServer(serverScript, env);
}

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
  process.exit(1);
});

main().catch((error) => {
  console.error("Startup failed.", error);
  process.exit(1);
});

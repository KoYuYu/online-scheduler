const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

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

async function main() {
  await verifyDatabase();

  process.env.PORT = port;
  process.env.HOSTNAME = process.env.HOSTNAME || "0.0.0.0";
  process.env.LOCAL_DATA_PATH = localDataPath;

  if (fs.existsSync(standaloneServer)) {
    require(standaloneServer);
    return;
  }

  process.argv = [process.execPath, ...args];
  require(path.join(process.cwd(), args[0]));
}

main().catch((error) => {
  console.error("Startup failed.", error);
  process.exit(1);
});

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const port = process.env.PORT || "3000";
const localDataPath = process.env.LOCAL_DATA_PATH || path.join(os.tmpdir(), "online-scheduler", "scheduler.json");
const standaloneServer = path.join(process.cwd(), ".next", "standalone", "server.js");
const args = fs.existsSync(standaloneServer)
  ? [standaloneServer]
  : ["node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", port];

const child = spawn(process.execPath, args, {
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: port,
    HOSTNAME: process.env.HOSTNAME || "0.0.0.0",
    LOCAL_DATA_PATH: localDataPath,
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  }
  process.exit(code || 0);
});

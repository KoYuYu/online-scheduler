const fs = require("node:fs");
const path = require("node:path");

function copyIfExists(from, to) {
  if (!fs.existsSync(from)) {
    return;
  }
  fs.rmSync(to, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}

const root = process.cwd();
const standaloneDir = path.join(root, ".next", "standalone");

if (!fs.existsSync(standaloneDir)) {
  console.log("No standalone output found; skipping standalone asset copy.");
  process.exit(0);
}

copyIfExists(path.join(root, ".next", "static"), path.join(standaloneDir, ".next", "static"));
copyIfExists(path.join(root, "public"), path.join(standaloneDir, "public"));
console.log("Standalone assets are ready.");

const { spawn } = require("node:child_process");
const path = require("node:path");

const root = __dirname;
const isWindows = process.platform === "win32";

function run(command, args, cwd) {
  return spawn(command, args, {
    cwd,
    stdio: "inherit",
    shell: isWindows,
  });
}

const backend = run(
  "go",
  ["run", "./cmd/server"],
  path.join(root, "backend")
);

const frontend = run(
  isWindows ? "npm.cmd" : "npm",
  ["run", "dev"],
  path.join(root, "frontend")
);

function stop() {
  backend.kill();
  frontend.kill();
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
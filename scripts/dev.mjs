import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const syncProc = spawn("node", [path.join(root, "scripts", "sync-content.mjs"), "--watch"], {
  cwd: root,
  stdio: "inherit"
});

const devProc = spawn("npx", ["astro", "dev"], {
  cwd: root,
  stdio: "inherit"
});

const shutdown = () => {
  if (!syncProc.killed) syncProc.kill("SIGTERM");
  if (!devProc.killed) devProc.kill("SIGTERM");
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

devProc.on("exit", (code) => {
  if (!syncProc.killed) syncProc.kill("SIGTERM");
  process.exit(code ?? 0);
});

syncProc.on("exit", (code) => {
  if (code && !devProc.killed) {
    console.error(`sync-content watcher exited with code ${code}`);
    devProc.kill("SIGTERM");
    process.exit(code);
  }
});

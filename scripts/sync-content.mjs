import { watch } from "node:fs";
import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const pairs = [
  {
    source: path.join(root, "_posts"),
    destination: path.join(root, "src", "content", "posts")
  },
  {
    source: path.join(root, "_projects"),
    destination: path.join(root, "src", "content", "projects")
  }
];

const syncDirectory = async ({ source, destination }) => {
  await mkdir(destination, { recursive: true });
  const sourceEntries = (await readdir(source)).filter((name) => name.endsWith(".md"));
  const destinationEntries = (await readdir(destination)).filter((name) => name.endsWith(".md"));

  await Promise.all(
    sourceEntries.map((name) =>
      copyFile(path.join(source, name), path.join(destination, name))
    )
  );

  const sourceSet = new Set(sourceEntries);
  const staleEntries = destinationEntries.filter((name) => !sourceSet.has(name));
  await Promise.all(staleEntries.map((name) => rm(path.join(destination, name), { force: true })));
};

const syncAll = async () => {
  await Promise.all(pairs.map(syncDirectory));
  console.log("Synced content from _posts and _projects into src/content.");
};

const watchMode = process.argv.includes("--watch");
await syncAll();

if (watchMode) {
  let debounceTimer = null;
  const scheduleSync = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      syncAll().catch((error) => {
        console.error("sync-content failed:", error);
      });
    }, 100);
  };

  const watchers = pairs.map(({ source }) => watch(source, scheduleSync));
  console.log("Watching _posts and _projects for changes...");

  const cleanup = () => {
    watchers.forEach((watcher) => watcher.close());
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

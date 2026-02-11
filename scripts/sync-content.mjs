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

  const validSource = new Set(sourceEntries);
  const stale = destinationEntries.filter((name) => !validSource.has(name));
  await Promise.all(stale.map((name) => rm(path.join(destination, name), { force: true })));

  await Promise.all(
    sourceEntries.map((name) =>
      copyFile(path.join(source, name), path.join(destination, name))
    )
  );
};

await Promise.all(pairs.map(syncDirectory));
console.log("Synced content from _posts and _projects into src/content.");

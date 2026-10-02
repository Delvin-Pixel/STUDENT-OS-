import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve("dist/public");
const requiredFiles = [
  path.resolve("dist/index.js"),
  path.join(root, "index.html"),
  path.join(root, "precache.json"),
  path.join(root, "sw.js"),
  path.join(root, "manifest.webmanifest"),
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file))
    throw new Error(`Required production file missing: ${file}`);
}

execFileSync(process.execPath, ["--check", path.resolve("dist/index.js")], {
  stdio: "inherit",
});

const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "precache.json"), "utf8")
);
if (!Array.isArray(manifest) || manifest.length === 0) {
  throw new Error("precache.json must be a non-empty array");
}

for (const entry of manifest) {
  if (
    typeof entry !== "string" ||
    !entry.startsWith("/") ||
    entry.startsWith("//")
  ) {
    throw new Error(`Unsafe precache entry: ${String(entry)}`);
  }
  const target = path.join(root, entry.slice(1));
  if (!fs.existsSync(target)) {
    throw new Error(
      `Precache entry does not exist in production bundle: ${entry}`
    );
  }
}

for (const required of [
  "manifest.webmanifest",
  "logo.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
]) {
  if (!fs.existsSync(path.join(root, required))) {
    throw new Error(`Required PWA shell asset missing: ${required}`);
  }
}

console.log(`Production bundle verified: ${manifest.length} precache entries.`);

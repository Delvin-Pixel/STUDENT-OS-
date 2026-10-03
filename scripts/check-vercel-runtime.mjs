import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";

// Exercise the emitted Node entrypoint, not Vitest's TypeScript import resolver.
process.env.VERCEL = "1";
const { default: app } = await import("../api/index.mjs");
const server = createServer(app);
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
try {
  const origin = `http://127.0.0.1:${server.address().port}`;
  const release = await fetch(`${origin}/api/release-info`);
  assert.equal(release.status, 200);
  assert.match(release.headers.get("cache-control"), /no-store/);
  assert.equal(typeof (await release.json()).serviceWorkerVersion, "string");
  const auth = await fetch(`${origin}/api/trpc/auth.me`);
  assert.equal(auth.status, 200);
  assert.equal((await auth.json()).result.data.json, null);
  const worker = await fetch(`${origin}/api/service-worker-v15.js`);
  assert.equal(worker.status, 200);
  assert.equal(worker.headers.get("service-worker-allowed"), "/");
  assert.match(worker.headers.get("cache-control"), /no-store/);
  assert.equal(worker.headers.get("cdn-cache-control"), "no-store");
  assert.equal(
    await worker.text(),
    await readFile("dist/public/sw.js", "utf8")
  );
  const missing = await fetch(`${origin}/api/does-not-exist`);
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: "Not found" });
  console.log(
    "Built Vercel handler: release, anonymous session, worker privacy, and API 404 verified."
  );
} finally {
  await new Promise((resolve, reject) =>
    server.close(error => (error ? reject(error) : resolve()))
  );
}

import { basename } from "node:path";

/**
 * HTML and service-worker scripts are release pointers, not immutable assets.
 * Their cache policy must allow a browser/CDN to revalidate them before it can
 * discover a new content-hashed bundle or updated worker.
 */
export function cacheControlForStaticPath(
  filePath: string
): string | undefined {
  const fileName = basename(filePath);
  if (fileName === "index.html" || /^sw(?:-[a-z0-9]+)?\.js$/i.test(fileName))
    return "no-cache, must-revalidate";
  return undefined;
}

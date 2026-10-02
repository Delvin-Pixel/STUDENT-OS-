import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";

/** Emit the production asset manifest consumed by the Student OS service worker. */
function vitePluginPrecacheManifest(): Plugin {
  return {
    name: "student-os-precache-manifest",
    generateBundle(_options, bundle) {
      const emittedAssets = Object.keys(bundle)
        .filter(fileName =>
          /^(?:[^/]+\/)*[^/]+\.(?:css|woff2?|webp|svg|png)$/.test(fileName)
        )
        .map(fileName => `/${fileName}`);

      const entryScripts = Object.values(bundle)
        .filter(asset => asset.type === "chunk" && asset.isEntry)
        .map(asset => `/${asset.fileName}`);

      this.emitFile({
        type: "asset",
        fileName: "precache.json",
        source: JSON.stringify([
          ...new Set([...entryScripts, ...emittedAssets]),
        ]),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), vitePluginPrecacheManifest()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    // Development host allow-list is intentionally provider-neutral.
    allowedHosts: ["localhost", "127.0.0.1"],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});

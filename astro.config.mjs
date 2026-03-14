import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://danagbemava.github.io",
  output: "static",

  vite: {
    plugins: [tailwindcss()],
    build: {
      chunkSizeWarningLimit: 650,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules/three/examples/jsm/loaders/GLTFLoader")) {
              return "three-loader";
            }
            if (id.includes("node_modules/three/src/renderers")) {
              return "three-renderer";
            }
            if (id.includes("node_modules/three/src/geometries")) {
              return "three-geometries";
            }
            if (id.includes("node_modules/three/src/materials")) {
              return "three-materials";
            }
            if (id.includes("node_modules/three")) {
              return "three-core";
            }
            if (
              id.includes("/src/scripts/open-world.js")
              || id.includes("/src/scripts/world-assets.js")
              || id.includes("/src/scripts/world-events.js")
              || id.includes("/src/scripts/world-state.js")
              || id.includes("/src/scripts/sfx.js")
            ) {
              return "open-world-runtime";
            }
            return undefined;
          }
        }
      }
    }
  }
});

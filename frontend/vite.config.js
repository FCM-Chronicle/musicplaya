import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync, mkdirSync } from "fs";
import { resolve } from "path";

const copyToFlutterAssets = {
  name: "copy-to-flutter-assets",
  closeBundle() {
    const dest = resolve(__dirname, "../assets/web");
    mkdirSync(`${dest}/assets`, { recursive: true });
    copyFileSync(resolve(__dirname, "dist/assets/musicplaya.js"), `${dest}/assets/musicplaya.js`);
    // index.html: script at end of body (not in head) so #root exists when JS runs
    const html = `<!doctype html>\n<html lang="ko">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Music Playa</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script src="./assets/musicplaya.js"></script>\n  </body>\n</html>\n`;
    require("fs").writeFileSync(`${dest}/index.html`, html);
    console.log("[copy-to-flutter-assets] Copied dist → assets/web");
  },
};

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    copyToFlutterAssets,
  ],
  build: {
    rollupOptions: {
      output: {
        format: "iife",
        inlineDynamicImports: true,
        entryFileNames: "assets/musicplaya.js",
      },
    },
  },
});

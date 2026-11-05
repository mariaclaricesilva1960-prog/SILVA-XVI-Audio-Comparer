import { defineConfig } from "vite";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
const buildId = (process.env.GITHUB_SHA || process.env.PWA_BUILD_ID || "local").slice(0, 8);

export default defineConfig({
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_ID__: JSON.stringify(buildId)
  }
});

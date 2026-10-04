import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// The one config file. In dev it is served from disk on every request; in
// production Caddy serves the same file, mounted into the container.
const LABS_FILE = process.env.LABS_CONFIG ?? resolve(__dirname, "../config/labs.json");

function serveLabsConfig(): Plugin {
  return {
    name: "serve-labs-config",
    configureServer(server) {
      server.middlewares.use("/labs.json", (_req, res) => {
        // urlMode "local": labs are reached on localhost:<port> instead of <id>.<domain>.
        const config = { ...JSON.parse(readFileSync(LABS_FILE, "utf-8")), urlMode: "local" };
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        res.end(JSON.stringify(config));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), serveLabsConfig()],
});

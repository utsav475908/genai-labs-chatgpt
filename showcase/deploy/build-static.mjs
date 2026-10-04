#!/usr/bin/env node
// Builds the showcase shell and each enabled lab's Next.js UI into static files:
//   <out>/shell/          the React showcase
//   <out>/labs/<id>/      one folder per lab, served at https://<id>.<domain>
// Labs are exported with NEXT_PUBLIC_API_URL=/api, which Caddy proxies to that lab's backend.
// Run inside web.Dockerfile on a throwaway copy: it writes next.config.mjs and out/ into lab folders.
// LABS=v1,v10 limits the build to those labs (handy for trying it locally).

import { execSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO = resolve(import.meta.dirname, "../..");
const OUT = resolve(process.argv[2] ?? join(REPO, "showcase/deploy/generated/static"));
const STATIC_EXPORT_CONFIG = "export default { output: 'export', images: { unoptimized: true } };\n";

function run(command, cwd, env = {}) {
  console.log(`\n$ (${cwd.replace(REPO, ".")}) ${command}`);
  execSync(command, { cwd, stdio: "inherit", env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", ...env } });
}

function install(dir) {
  run(existsSync(join(dir, "package-lock.json")) ? "npm ci --no-audit --no-fund" : "npm install --no-audit --no-fund", dir);
}

function buildShell() {
  const dir = join(REPO, "showcase/shell");
  install(dir);
  run("npm run build", dir);
  cpSync(join(dir, "dist"), join(OUT, "shell"), { recursive: true });
}

function buildLab(lab) {
  const dir = join(REPO, lab.dir, "frontend");
  const hasOwnConfig = ["next.config.js", "next.config.mjs", "next.config.ts"].some((f) => existsSync(join(dir, f)));
  if (hasOwnConfig) {
    console.warn(`${lab.id}: has its own next.config; it must set output: 'export' for this build to work`);
  } else {
    writeFileSync(join(dir, "next.config.mjs"), STATIC_EXPORT_CONFIG);
  }
  install(dir);
  run("npx next build", dir, { NEXT_PUBLIC_API_URL: "/api" });
  if (!existsSync(join(dir, "out", "index.html"))) throw new Error(`${lab.id}: next build produced no out/index.html`);
  cpSync(join(dir, "out"), join(OUT, "labs", lab.id), { recursive: true });
}

const config = JSON.parse(readFileSync(join(REPO, "showcase/config/labs.json"), "utf-8"));
const only = process.env.LABS?.split(",").filter(Boolean);
const labs = config.labs.filter((lab) => lab.enabled !== false && (!only || only.includes(lab.id)));

rmSync(OUT, { recursive: true, force: true });
buildShell();
for (const lab of labs) buildLab(lab);
console.log(`\nBuilt shell + ${labs.length} labs into ${OUT}`);

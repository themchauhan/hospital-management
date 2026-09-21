#!/usr/bin/env node
// Phase 1b requirement: no service-role key or DB credentials may
// appear in any file shipped to the client. Scans the built
// `.next/static` client bundle (never `.next/server`, which is
// server-only Node code and legitimately contains the key) for the
// literal SUPABASE_SERVICE_ROLE_KEY value. Run after `npm run build`.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const TEXT_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".css", ".json", ".txt", ".map"]);

const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  console.log("SUPABASE_SERVICE_ROLE_KEY not set — skipping client-bundle secret scan.");
  process.exit(0);
}

const clientDir = path.join(process.cwd(), ".next", "static");

function walk(dir, found) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, found);
    } else if (TEXT_EXTENSIONS.has(path.extname(full))) {
      const content = readFileSync(full, "utf8");
      if (content.includes(key)) {
        found.push(full);
      }
    }
  }
}

const found = [];
try {
  walk(clientDir, found);
} catch {
  console.error(`Could not read ${clientDir} — run \`npm run build\` first.`);
  process.exit(1);
}

if (found.length > 0) {
  console.error("SERVICE ROLE KEY FOUND IN CLIENT BUNDLE:");
  found.forEach((f) => console.error(`  ${f}`));
  process.exit(1);
}

console.log(`OK: service-role key not found in ${clientDir}`);

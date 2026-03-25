#!/usr/bin/env node
// Writes a .meta.json file with proper JSON escaping.
// Usage: node write-meta.js <output-path> [commit-sha] [error-message]

const fs = require("fs");

const [, , outPath, commitSha, errorMsg] = process.argv;

if (!outPath) {
  console.error("Usage: write-meta.js <output-path> [commit-sha] [error-message]");
  process.exit(1);
}

const meta = { commit: commitSha || null };
if (errorMsg) {
  meta.error = errorMsg;
}

fs.writeFileSync(outPath, JSON.stringify(meta) + "\n");

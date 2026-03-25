#!/usr/bin/env node
// Reads revisions.json and outputs repo metadata.
// Usage:
//   node parse-revisions.js <revisions.json> meta
//     → prints: scoring_version\trubric_version\trepo_count
//   node parse-revisions.js <revisions.json> repo <index>
//     → prints: name\trepo\tref\tlanguage\tdescription
//   node parse-revisions.js <revisions.json> all
//     → prints one TSV line per repo: name\trepo\tref\tlanguage\tdescription

const fs = require("fs");

const [, , filePath, command, indexStr] = process.argv;

if (!filePath || !command) {
  console.error("Usage: parse-revisions.js <file> meta | repo <index> | all");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

if (command === "meta") {
  const parts = [data.scoring_version, data.rubric_version, String(data.repos.length)];
  console.log(parts.join("\t"));
} else if (command === "all") {
  for (const r of data.repos) {
    console.log([r.name, r.repo, r.ref, r.language, r.description].join("\t"));
  }
} else if (command === "repo") {
  const i = parseInt(indexStr, 10);
  const r = data.repos[i];
  if (!r) {
    console.error(`No repo at index ${i}`);
    process.exit(1);
  }
  const parts = [r.name, r.repo, r.ref, r.language, r.description];
  console.log(parts.join("\t"));
} else {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}

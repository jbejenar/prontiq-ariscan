#!/usr/bin/env node
// Builds summary.json from per-repo result files and scan metadata.
// Usage: node build-summary.js <revisions.json> <results-dir> <summary-out>
//
// Reads revisions.json for config, scans results-dir for per-repo JSON files,
// and writes a properly-escaped summary.json using JSON.stringify.

const fs = require("fs");
const path = require("path");

const [, , revisionsPath, resultsDir, summaryOut] = process.argv;

if (!revisionsPath || !resultsDir || !summaryOut) {
  console.error(
    "Usage: build-summary.js <revisions.json> <results-dir> <summary-out>"
  );
  process.exit(1);
}

const revisions = JSON.parse(fs.readFileSync(revisionsPath, "utf8"));
const results = [];

for (const repo of revisions.repos) {
  const resultFile = path.join(resultsDir, `${repo.name}.json`);
  const metaFile = path.join(resultsDir, `${repo.name}.meta.json`);

  // Read scan metadata (commit SHA, scan status)
  let meta = {};
  if (fs.existsSync(metaFile)) {
    meta = JSON.parse(fs.readFileSync(metaFile, "utf8"));
  }

  const entry = {
    name: repo.name,
    repo: repo.repo,
    ref: repo.ref,
    commit: meta.commit || null,
    language: repo.language,
    description: repo.description,
  };

  if (fs.existsSync(resultFile) && !meta.error) {
    try {
      const scan = JSON.parse(fs.readFileSync(resultFile, "utf8"));
      entry.score = scan.composite.score;
      entry.level = scan.composite.level;
    } catch {
      entry.score = null;
      entry.level = null;
      entry.error = "failed to parse result";
    }
  } else {
    entry.score = null;
    entry.level = null;
    entry.error = meta.error || "scan failed";
  }

  results.push(entry);
}

const summary = {
  date: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
  scoring_version: revisions.scoring_version,
  rubric_version: revisions.rubric_version,
  total: revisions.repos.length,
  scanned: results.filter((r) => r.score !== null).length,
  failed: results.filter((r) => r.score === null).length,
  results,
};

fs.writeFileSync(summaryOut, JSON.stringify(summary, null, 2) + "\n");
console.log(
  `Summary: ${summary.scanned} scanned, ${summary.failed} failed → ${summaryOut}`
);

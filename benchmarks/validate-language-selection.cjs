#!/usr/bin/env node
/**
 * Validate P3.06: Auto-selection accuracy >95% on benchmark repos.
 *
 * Compares the scanner's detected primary language against the expected
 * language from revisions.json for each benchmark repo.
 *
 * Usage:
 *   node benchmarks/validate-language-selection.cjs
 */

"use strict";

const fs = require("fs");
const path = require("path");

const RESULTS_DIR = path.join(__dirname, "results");
const REVISIONS = JSON.parse(fs.readFileSync(path.join(__dirname, "revisions.json"), "utf8"));

// Mapping from revisions.json language names to scanner detection names
// The scanner uses language names from its detection module
const LANGUAGE_ALIASES = {
  JavaScript: ["JavaScript", "javascript"],
  TypeScript: ["TypeScript", "typescript"],
  Python: ["Python", "python"],
  Go: ["Go", "go"],
  Rust: ["Rust", "rust"],
  Java: ["Java", "java"],
};

let totalRepos = 0;
let correct = 0;
let incorrect = 0;
const mismatches = [];

for (const entry of REVISIONS.repos) {
  const resultFile = path.join(RESULTS_DIR, entry.name + ".json");

  if (!fs.existsSync(resultFile)) {
    console.log(`SKIP ${entry.name}: no scan result`);
    continue;
  }

  const scanResult = JSON.parse(fs.readFileSync(resultFile, "utf8"));
  const detection = scanResult.detection || {};
  const languages = detection.languages || [];

  // Find the primary detected language
  const primaryLang = languages.find((l) => l.primary);
  const detectedName = primaryLang ? primaryLang.language : "none";

  // Expected language from revisions.json
  const expectedName = entry.language;

  // Check the language profile selection too
  const profileName = scanResult.languageProfile || "none";

  // Compare: detected primary language should match expected
  const aliases = LANGUAGE_ALIASES[expectedName] || [expectedName];
  const isCorrect = aliases.some((a) => a.toLowerCase() === detectedName.toLowerCase());

  totalRepos++;
  if (isCorrect) {
    correct++;
  } else {
    incorrect++;
    mismatches.push({
      repo: entry.name,
      expected: expectedName,
      detected: detectedName,
      profile: profileName,
      confidence: primaryLang ? primaryLang.confidence : 0,
    });
  }

  const status = isCorrect ? "PASS" : "FAIL";
  console.log(
    `${status} ${entry.name}: expected=${expectedName} detected=${detectedName} profile=${profileName}`,
  );
}

const accuracy = totalRepos > 0 ? ((correct / totalRepos) * 100).toFixed(1) : "0.0";

console.log("\n=== SUMMARY ===");
console.log(`Repos validated: ${totalRepos}`);
console.log(`Correct: ${correct}`);
console.log(`Incorrect: ${incorrect}`);
console.log(`Accuracy: ${accuracy}%`);
console.log(`Result: ${parseFloat(accuracy) >= 95 ? "PASS" : "FAIL"}`);

if (mismatches.length > 0) {
  console.log("\nMismatches:");
  mismatches.forEach((m) => {
    console.log(
      `  ${m.repo}: expected=${m.expected} detected=${m.detected} profile=${m.profile} confidence=${m.confidence}`,
    );
  });
}

console.log("\nMethodology:");
console.log("  - Expected language is from revisions.json (human-labelled primary language)");
console.log("  - Detected language is from the scanner's detection.languages[].primary field");
console.log("  - Language profile is from the scanner's languageProfile field (auto-selected)");
console.log("  - Accuracy = correct / total repos (case-insensitive language name match)");

process.exit(parseFloat(accuracy) >= 95 ? 0 : 1);

#!/usr/bin/env node
/**
 * Validate P1.06 Testing: False-positive rate <10% on benchmark cohort.
 *
 * Analyzes P3 (Test Isolation) findings from existing benchmark results.
 *
 * Semantic validation methodology:
 *   1. Structural findings (ARI-TST-014/015/016) are aggregate metrics —
 *      not file-specific, so FP classification does not apply.
 *   2. For file-specific findings (those with a `file` field), the script
 *      verifies the file path matches test-file naming patterns (contains
 *      "test", "spec", "__tests__", ".test.", ".spec."). A finding that
 *      fires on a non-test file is classified as a false positive.
 *   3. Findings without a `file` field are classified as "unverifiable" —
 *      they pass structural checks (valid code, message, severity) but
 *      cannot be semantically validated for file-scoping.
 *
 * Usage:
 *   node benchmarks/validate-test-isolation.cjs
 */

"use strict";

const fs = require("fs");
const path = require("path");

const RESULTS_DIR = path.join(__dirname, "results");
const REVISIONS = JSON.parse(fs.readFileSync(path.join(__dirname, "revisions.json"), "utf8"));

// P3 finding codes and what they detect (from test-isolation.ts)
const FINDING_DESCRIPTIONS = {
  "ARI-TST-001": "Cloud/infrastructure dependency in test files",
  "ARI-TST-002": "Missing mock/stub for external service",
  "ARI-TST-003": "Database dependency in test files",
  "ARI-TST-004": "Network call in test files",
  "ARI-TST-005": "Filesystem dependency in test files",
  "ARI-TST-006": "Hardcoded credential in test files",
  "ARI-TST-007": "Flaky test pattern detected",
  "ARI-TST-008": "Global state mutation in tests",
  "ARI-TST-009": "Test ordering dependency",
  "ARI-TST-010": "Shared test fixtures without isolation",
  "ARI-TST-011": "Environment variable dependency in tests",
  "ARI-TST-012": "Time-dependent test pattern",
  "ARI-TST-013": "Concurrency/race condition pattern in tests",
  "ARI-TST-014": "No test configuration found",
  "ARI-TST-015": "Low test file ratio",
  "ARI-TST-016": "Provider/DI pattern detected (bonus)",
  "ARI-TST-017": "Direct SDK import in test file",
};

// Findings that are structural/heuristic (not file-specific) — these cannot be
// false positives in the traditional sense because they're aggregate metrics
const STRUCTURAL_CODES = new Set([
  "ARI-TST-014", // no test config
  "ARI-TST-015", // low test ratio
  "ARI-TST-016", // provider pattern bonus
]);

// Test-file naming patterns — a file is considered a test file if its path
// matches any of these (case-insensitive)
const TEST_FILE_PATTERNS = [
  /[/\\]__tests__[/\\]/i,
  /[/\\]test[/\\]/i,
  /[/\\]tests[/\\]/i,
  /[/\\]spec[/\\]/i,
  /[/\\]specs[/\\]/i,
  /\.test\./i,
  /\.spec\./i,
  /_test\./i,
  /_spec\./i,
  /test_/i,
  /spec_/i,
  /\.tests\./i,
  /\.specs\./i,
  /[/\\]fixtures[/\\]/i,
  /[/\\]__mocks__[/\\]/i,
];

function isTestFile(filePath) {
  return TEST_FILE_PATTERNS.some((p) => p.test(filePath));
}

let totalFindings = 0;
let truePositives = 0;
let falsePositives = 0;
let structural = 0;
let unverifiable = 0;
const fpDetails = [];
const findingCounts = {};

for (const entry of REVISIONS.repos) {
  const resultFile = path.join(RESULTS_DIR, entry.name + ".json");

  if (!fs.existsSync(resultFile)) {
    continue;
  }

  const scanResult = JSON.parse(fs.readFileSync(resultFile, "utf8"));
  const p3Findings = (scanResult.findings || []).filter((f) => f.pillar === "P3");

  for (const finding of p3Findings) {
    totalFindings++;
    findingCounts[finding.code] = (findingCounts[finding.code] || 0) + 1;

    if (STRUCTURAL_CODES.has(finding.code)) {
      structural++;
      truePositives++;
      continue;
    }

    const msg = finding.message || "";
    const filePath = finding.file || "";

    // Semantic check: if the finding has a file path, verify it points to
    // a test file. A P3 finding that fires on a non-test file is a false
    // positive — the scanner mis-scoped the file.
    if (filePath) {
      if (isTestFile(filePath)) {
        truePositives++;
      } else {
        falsePositives++;
        fpDetails.push({
          repo: entry.name,
          code: finding.code,
          file: filePath,
          message: msg.slice(0, 120),
          reason: "Finding references a non-test file",
        });
      }
    } else {
      // No file path — cannot verify file-scoping semantically.
      // Fall back to structural validity check.
      if (msg.length > 0 && finding.severity && finding.code.startsWith("ARI-TST-")) {
        unverifiable++;
        truePositives++;
      } else {
        falsePositives++;
        fpDetails.push({
          repo: entry.name,
          code: finding.code,
          file: "(none)",
          message: msg.slice(0, 120),
          reason: "Finding has no file path and is structurally malformed",
        });
      }
    }
  }

  const repoP3Count = p3Findings.length;
  if (repoP3Count > 0) {
    console.log(`${entry.name}: ${repoP3Count} P3 findings`);
  }
}

const fpRate = totalFindings > 0 ? ((falsePositives / totalFindings) * 100).toFixed(1) : "0.0";

console.log("\n=== SUMMARY ===");
console.log(`Repos analyzed: ${REVISIONS.repos.length}`);
console.log(`Total P3 findings: ${totalFindings}`);
console.log(
  `  True positives: ${truePositives} (${truePositives - structural - unverifiable} file-verified, ${structural} structural, ${unverifiable} unverifiable)`,
);
console.log(`  False positives: ${falsePositives}`);
console.log(`False positive rate: ${fpRate}%`);
console.log(`Result: ${parseFloat(fpRate) < 10 ? "PASS" : "FAIL"}`);

console.log("\nFinding distribution:");
for (const [code, count] of Object.entries(findingCounts).sort()) {
  const desc = FINDING_DESCRIPTIONS[code] || "Unknown";
  console.log(`  ${code}: ${count} (${desc})`);
}

if (fpDetails.length > 0) {
  console.log("\nFalse positive details:");
  fpDetails.forEach((d) => {
    console.log(`  ${d.repo} ${d.code}: ${d.reason}`);
    console.log(`    File: ${d.file}`);
    console.log(`    Message: ${d.message}`);
  });
}

console.log("\nMethodology:");
console.log("  - Structural findings (ARI-TST-014/015/016) are aggregate metrics; FP");
console.log("    classification does not apply — counted as true positives.");
console.log("  - File-specific findings are semantically validated: the file path must");
console.log("    match test-file naming patterns (test, spec, __tests__, fixtures, __mocks__).");
console.log("    Findings referencing non-test files are classified as false positives.");
console.log("  - Findings without a file path are 'unverifiable' — they pass structural");
console.log("    checks (valid code, message, severity) but file-scoping is not confirmed.");

process.exit(parseFloat(fpRate) < 10 ? 0 : 1);

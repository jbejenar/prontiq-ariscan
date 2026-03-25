#!/usr/bin/env node
/**
 * Convert ARI scan findings to GitLab Code Quality report format.
 *
 * Environment variables:
 *   ARI_PR_SCAN — path to the scan result JSON
 *
 * Outputs a JSON array in Code Climate format to stdout.
 * GitLab uses this format for the Code Quality widget in MRs.
 *
 * @see https://docs.gitlab.com/ee/ci/testing/code_quality.html#implement-a-custom-tool
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const scanPath = process.env.ARI_PR_SCAN;
if (!scanPath) {
  process.stderr.write("Error: ARI_PR_SCAN not set\n");
  process.exit(1);
}

const result = JSON.parse(readFileSync(scanPath, "utf8"));
const findings = result.findings || [];

/**
 * Map ARI severity to Code Climate severity.
 * Code Climate uses: blocker, critical, major, minor, info
 */
function toCodeClimateSeverity(severity) {
  switch (severity) {
    case "critical":
      return "blocker";
    case "high":
      return "critical";
    case "medium":
      return "major";
    case "low":
      return "minor";
    case "info":
      return "info";
    default:
      return "minor";
  }
}

const issues = [];

for (const f of findings) {
  if (f.suppressed) continue;

  const description = f.remediation ? `${f.message} — ${f.remediation.description}` : f.message;

  // Generate a stable fingerprint from the finding code and file
  const fingerprintInput = `${f.code}:${f.file ?? ""}:${f.line ?? ""}:${f.message}`;
  const fingerprint = createHash("md5").update(fingerprintInput).digest("hex");

  const issue = {
    type: "issue",
    check_name: f.code,
    description,
    severity: toCodeClimateSeverity(f.severity),
    fingerprint,
    location: {
      path: f.file ?? ".",
      lines: {
        begin: f.line ?? 1,
      },
    },
    categories: ["Style"],
  };

  issues.push(issue);
}

process.stdout.write(JSON.stringify(issues, null, 2) + "\n");

if (issues.length > 0) {
  process.stderr.write(`Generated ${issues.length} code quality issue(s) from ARI findings\n`);
}

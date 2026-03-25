#!/usr/bin/env node
/**
 * Create GitHub Actions annotations from ARI scan findings.
 *
 * Environment variables:
 *   ARI_PR_SCAN — path to the scan result JSON
 *
 * Emits ::warning and ::error workflow commands for findings that have
 * file locations, enabling inline annotations on changed files in PRs.
 */
import { readFileSync } from "node:fs";

const scanPath = process.env.ARI_PR_SCAN;
if (!scanPath) {
  process.stderr.write("Error: ARI_PR_SCAN not set\n");
  process.exit(1);
}

const result = JSON.parse(readFileSync(scanPath, "utf8"));
const findings = result.findings || [];

// Severity → GitHub annotation level
function toAnnotationLevel(severity) {
  switch (severity) {
    case "critical":
    case "high":
      return "error";
    case "medium":
    case "low":
      return "warning";
    case "info":
      return "notice";
    default:
      return "warning";
  }
}

let count = 0;
for (const f of findings) {
  if (f.suppressed) continue;
  if (!f.file) continue;

  const level = toAnnotationLevel(f.severity);
  const loc = f.line ? `file=${f.file},line=${f.line}` : `file=${f.file}`;
  const title = `${f.code} (${f.severity})`;
  const sanitize = (s) => s.replace(/\r?\n/g, " ").replace(/::/g, ": :");
  const msg = sanitize(f.remediation ? `${f.message} — ${f.remediation.description}` : f.message);

  process.stdout.write(`::${level} ${loc},title=${title}::${msg}\n`);
  count++;
}

if (count > 0) {
  process.stderr.write(`Created ${count} annotation(s) from ARI findings\n`);
}

#!/usr/bin/env node
/**
 * Generate a GitLab MR comment body for ARI scan results.
 *
 * Environment variables:
 *   ARI_PR_SCAN    — path to MR branch scan JSON
 *   ARI_BASE_SCAN  — path to target branch scan JSON (optional, for delta)
 *   ARI_DELTA      — numeric delta value (optional)
 *   ARI_BASE_SCORE — target branch score (optional)
 *
 * Outputs the markdown comment body to stdout.
 */
import { readFileSync } from "node:fs";

const prScanPath = process.env.ARI_PR_SCAN;
if (!prScanPath) {
  process.stderr.write("Error: ARI_PR_SCAN not set\n");
  process.exit(1);
}

const pr = JSON.parse(readFileSync(prScanPath, "utf8"));
const score = pr.score;
const level = pr.level;
const levelName = pr.levelMeta?.name ?? level;

// Delta info
const deltaStr = process.env.ARI_DELTA;
const baseScanPath = process.env.ARI_BASE_SCAN;
const hasDelta = deltaStr !== undefined && deltaStr !== "";
const delta = hasDelta ? parseInt(deltaStr, 10) : 0;

let base = null;
if (baseScanPath) {
  try {
    base = JSON.parse(readFileSync(baseScanPath, "utf8"));
  } catch {
    // Base scan not available
  }
}

// Header
let emoji = "📊";
let sign = "";
if (hasDelta) {
  if (delta > 0) {
    emoji = "📈";
    sign = "+";
  } else if (delta < 0) {
    emoji = "📉";
    sign = "";
  } else {
    emoji = "➡️";
    sign = "±";
  }
}

const lines = [];

if (hasDelta) {
  lines.push(
    `## ${emoji} ARI Score: ${score}/100 (${levelName}) — Delta: ${sign}${delta}`,
  );
} else {
  lines.push(`## ${emoji} ARI Score: ${score}/100 (${levelName})`);
}
lines.push("");

// Pillar comparison table
const pillars = pr.pillars || [];
const baseMap = {};
if (base?.pillars) {
  for (const p of base.pillars) {
    baseMap[p.pillar] = p;
  }
}

lines.push(
  "| Pillar | Name | Score | Weight | Status |" +
    (hasDelta ? " Delta |" : ""),
);
lines.push(
  "|--------|------|-------|--------|--------|" +
    (hasDelta ? "-------|" : ""),
);

for (const p of pillars) {
  const status = p.status ?? "—";
  const statusEmoji =
    status === "excellent"
      ? "🟢"
      : status === "good"
        ? "🔵"
        : status === "needs-improvement"
          ? "🟡"
          : status === "poor"
            ? "🔴"
            : "⚪";

  const pillarId = p.pillar ?? "—";
  const pillarName = p.name ?? "—";
  const pillarScore = p.score ?? 0;
  const pillarWeight = ((p.weight ?? 0) * 100).toFixed(0);

  let row = `| ${pillarId} | ${pillarName} | ${pillarScore} | ${pillarWeight}% | ${statusEmoji} ${status} |`;

  if (hasDelta) {
    const bp = baseMap[p.pillar];
    if (bp) {
      const d = pillarScore - (bp.score ?? 0);
      const ds = d > 0 ? `+${d}` : d < 0 ? `${d}` : `±0`;
      const di = d > 0 ? "🟢" : d < 0 ? "🔴" : "⚪";
      row += ` ${di} ${ds} |`;
    } else {
      row += " — |";
    }
  }

  lines.push(row);
}

lines.push("");

// Top 3 recommendations
const findings = (pr.findings || []).filter((f) => !f.suppressed);
const actionable = findings
  .filter((f) => f.remediation)
  .sort((a, b) => {
    const sev = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return (sev[a.severity] ?? 4) - (sev[b.severity] ?? 4);
  })
  .slice(0, 3);

if (actionable.length > 0) {
  lines.push("### Top Recommendations");
  lines.push("");
  for (const f of actionable) {
    const impact = f.remediation.estimatedImpact
      ? ` (${f.remediation.estimatedImpact})`
      : "";
    lines.push(
      `- **${f.code}** (${f.severity}): ${f.remediation.description}${impact}`,
    );
  }
  lines.push("");
}

// Security gate
if (pr.securityGateTriggered) {
  lines.push(
    "> **Security Gate Triggered:** P8 score below 40% caps maturity at L2.",
  );
  lines.push("");
}

// Footer
lines.push("---");
lines.push(
  `_Scanned by [Prontiq ARI](https://github.com/prontiq/ariscan) v${pr.metadata?.version ?? "unknown"} on ${new Date().toISOString().slice(0, 10)}_`,
);

process.stdout.write(lines.join("\n") + "\n");

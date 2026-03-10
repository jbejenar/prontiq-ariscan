import type { ScanResult, Finding } from "@prontiq/schema";

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

/** Impact score: higher severity + higher confidence = higher impact. */
function impactEaseScore(finding: Finding): number {
  const severityWeight: Record<string, number> = {
    critical: 10,
    high: 8,
    medium: 5,
    low: 3,
    info: 1,
  };
  const confidenceWeight: Record<string, number> = {
    high: 3,
    medium: 2,
    low: 1,
  };
  const impact = severityWeight[finding.severity] ?? 1;
  const ease = finding.remediation ? (confidenceWeight[finding.remediation.confidence] ?? 1) : 0;
  return impact * ease;
}

function severityEmoji(severity: string): string {
  switch (severity) {
    case "critical":
      return "🔴";
    case "high":
      return "🟠";
    case "medium":
      return "🟡";
    case "low":
      return "🔵";
    default:
      return "⚪";
  }
}

function scoreBar(score: number, width: number = 20): string {
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

function levelBadge(level: string, score: number): string {
  return `**${level}** · ${score}/100`;
}

/**
 * Format scan result as a Markdown report.
 * Designed for GitHub PR comments, Slack, and wikis.
 */
export function formatMarkdown(result: ScanResult): string {
  const lines: string[] = [];

  // Badge-ready summary line
  lines.push(`# ARI Score: ${result.score}/100 — ${result.level} ${result.levelMeta.name}`);
  lines.push("");

  // Composite score and maturity
  lines.push(`> ${levelBadge(result.level, result.score)}`);
  lines.push(`>`);
  lines.push(`> **${result.levelMeta.name}** — ${result.levelMeta.description}`);
  lines.push("");

  // Security gate
  if (result.securityGateTriggered) {
    lines.push("> ⚠️ **Security gate triggered:** Pillar 8 score < 40% — maturity capped at L2");
    lines.push("");
  }

  // Per-pillar table
  lines.push("## Pillar Scores");
  lines.push("");
  lines.push("| Pillar | Name | Score | Bar | Weight | Confidence |");
  lines.push("|--------|------|------:|-----|-------:|------------|");

  for (const pillar of result.pillars) {
    const weightPct = `${Math.round(pillar.weight * 100)}%`;
    const bar = `\`${scoreBar(pillar.score)}\``;
    lines.push(
      `| ${pillar.pillar} | ${pillar.name} | ${pillar.score} | ${bar} | ${weightPct} | ${pillar.confidence} |`,
    );
  }

  lines.push("");

  // Top findings (sorted by severity)
  const sortedFindings = [...result.findings].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99),
  );

  if (sortedFindings.length > 0) {
    lines.push("## Top Findings");
    lines.push("");

    const topFindings = sortedFindings.slice(0, 10);

    for (const finding of topFindings) {
      lines.push(formatFinding(finding));
    }

    if (sortedFindings.length > 10) {
      lines.push(`*...and ${sortedFindings.length - 10} more findings.*`);
      lines.push("");
    }
  }

  // Quick-start: First 3 actions (highest impact × ease)
  const actionable = sortedFindings
    .filter((f) => f.remediation && f.severity !== "info")
    .sort((a, b) => impactEaseScore(b) - impactEaseScore(a));

  if (actionable.length > 0) {
    lines.push("## Quick Start: Top 3 Actions");
    lines.push("");
    const top3 = actionable.slice(0, 3);
    for (const [idx, finding] of top3.entries()) {
      if (finding.remediation) {
        const impact = finding.remediation.estimatedImpact
          ? ` → ${finding.remediation.estimatedImpact}`
          : "";
        lines.push(
          `${idx + 1}. **\`${finding.code}\`** ${finding.remediation.description}${impact}`,
        );
      }
    }
    lines.push("");
  }

  // Remediation suggestions (ordered by impact × ease)
  const withRemediation = actionable;
  if (withRemediation.length > 0) {
    lines.push("## Suggested Remediations");
    lines.push("");

    const topRemediations = withRemediation.slice(0, 10);

    for (const finding of topRemediations) {
      if (finding.remediation) {
        const impact = finding.remediation.estimatedImpact
          ? ` (impact: ${finding.remediation.estimatedImpact})`
          : "";
        lines.push(`- **\`${finding.code}\`** — ${finding.remediation.description}${impact}`);
      }
    }

    lines.push("");
  }

  // Footer with scan metadata
  lines.push("---");
  lines.push("");
  lines.push(
    `*Scanned in ${result.metadata.duration}ms · ariscan v${result.metadata.version} · Rubric ${result.metadata.rubricVersion} · ${result.metadata.timestamp}*`,
  );
  lines.push("");

  return lines.join("\n");
}

function formatFinding(finding: Finding): string {
  const lines: string[] = [];
  const emoji = severityEmoji(finding.severity);
  const location = finding.file
    ? ` in \`${finding.file}${finding.line ? `:${finding.line}` : ""}\``
    : "";

  lines.push(
    `- ${emoji} **${finding.severity.toUpperCase()}** \`${finding.code}\` — ${finding.message}${location}`,
  );

  return lines.join("\n");
}

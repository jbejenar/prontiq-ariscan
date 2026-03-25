import type { ScanResult, Finding } from "@prontiq/ariscan-schema";

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

function formatPillarTable(result: ScanResult): string[] {
  const lines: string[] = [];
  lines.push("## Pillar Scores");
  lines.push("");
  lines.push("| Pillar | Name | Score | Bar | Weight | Confidence | Data |");
  lines.push("|--------|------|------:|-----|-------:|------------|------|");

  for (const pillar of result.pillars) {
    const weightPct = `${Math.round(pillar.weight * 100)}%`;
    if (pillar.dataStatus === "insufficient") {
      lines.push(
        `| ${pillar.pillar} | ${pillar.name} | --/100 | | ${weightPct} | ${pillar.confidence} | ⚠️ Insufficient |`,
      );
    } else {
      const bar = `\`${scoreBar(pillar.score)}\``;
      const dataLabel = pillar.dataStatus === "partial" ? "Partial" : "✓";
      lines.push(
        `| ${pillar.pillar} | ${pillar.name} | ${pillar.score} | ${bar} | ${weightPct} | ${pillar.confidence} | ${dataLabel} |`,
      );
    }
  }

  if (result.scoreBreakdown && result.scoreBreakdown.insufficientPillars > 0) {
    lines.push("");
    lines.push(
      `> **Note:** ${result.scoreBreakdown.insufficientPillars} pillar(s) excluded from composite due to insufficient data. Composite based on ${result.scoreBreakdown.activePillars} active pillars.`,
    );
  }

  lines.push("");
  return lines;
}

function formatTopFindings(sortedFindings: Finding[]): string[] {
  if (sortedFindings.length === 0) return [];
  const lines: string[] = [];
  lines.push("## Top Findings");
  lines.push("");

  for (const finding of sortedFindings.slice(0, 10)) {
    lines.push(formatFinding(finding));
  }

  if (sortedFindings.length > 10) {
    lines.push(`*...and ${sortedFindings.length - 10} more findings.*`);
    lines.push("");
  }
  return lines;
}

function formatQuickStart(actionable: Finding[]): string[] {
  if (actionable.length === 0) return [];
  const lines: string[] = [];
  lines.push("## Quick Start: Top 3 Actions");
  lines.push("");

  for (const [idx, finding] of actionable.slice(0, 3).entries()) {
    if (finding.remediation) {
      const impact = finding.remediation.estimatedImpact
        ? ` → ${finding.remediation.estimatedImpact}`
        : "";
      lines.push(`${idx + 1}. **\`${finding.code}\`** ${finding.remediation.description}${impact}`);
    }
  }

  lines.push("");
  return lines;
}

function formatRemediations(actionable: Finding[]): string[] {
  if (actionable.length === 0) return [];
  const lines: string[] = [];
  lines.push("## Suggested Remediations");
  lines.push("");

  for (const finding of actionable.slice(0, 10)) {
    if (finding.remediation) {
      const impact = finding.remediation.estimatedImpact
        ? ` (impact: ${finding.remediation.estimatedImpact})`
        : "";
      lines.push(`- **\`${finding.code}\`** — ${finding.remediation.description}${impact}`);
    }
  }

  lines.push("");
  return lines;
}

function formatFooter(metadata: ScanResult["metadata"]): string[] {
  return [
    "---",
    "",
    `*Scanned in ${metadata.duration}ms · ariscan v${metadata.version} · Rubric ${metadata.rubricVersion} · ${metadata.timestamp}*`,
    "",
  ];
}

/**
 * Format scan result as a Markdown report.
 * Designed for GitHub PR comments, Slack, and wikis.
 */
export function formatMarkdown(result: ScanResult): string {
  const lines: string[] = [];

  lines.push(`# ARI Score: ${result.score}/100 — ${result.level} ${result.levelMeta.name}`);
  lines.push("");
  lines.push(`> ${levelBadge(result.level, result.score)}`);
  lines.push(`>`);
  lines.push(`> **${result.levelMeta.name}** — ${result.levelMeta.description}`);
  lines.push("");

  if (result.securityGateTriggered) {
    lines.push("> ⚠️ **Security gate triggered:** Pillar 8 score < 40% — maturity capped at L2");
    lines.push("");
  }

  if (result.repoProfile) {
    const p = result.repoProfile;
    const naCount = result.findings.filter((f) => f.applicability === "not-applicable").length;
    const naLabel = naCount > 0 ? ` — ${naCount} findings not applicable` : "";
    lines.push(`> **Profile:** ${p.archetype} (${p.confidence} confidence)${naLabel}`);
    lines.push("");
  }

  lines.push(...formatPillarTable(result));

  // Filter out not-applicable findings from default display
  const applicableFindings = result.findings.filter((f) => f.applicability !== "not-applicable");
  const sortedFindings = [...applicableFindings].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99),
  );
  lines.push(...formatTopFindings(sortedFindings));

  const actionable = sortedFindings
    .filter((f) => f.remediation && f.severity !== "info")
    .sort((a, b) => impactEaseScore(b) - impactEaseScore(a));
  lines.push(...formatQuickStart(actionable));
  lines.push(...formatRemediations(actionable));
  lines.push(...formatFooter(result.metadata));

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

import pc from "picocolors";
import type { ScanResult, PillarResult, MaturityLevel } from "@prontiq/schema";

interface TerminalOptions {
  verbose?: boolean;
}

function levelColor(level: MaturityLevel): (text: string) => string {
  switch (level) {
    case "L1": return pc.red;
    case "L2": return pc.yellow;
    case "L3": return pc.cyan;
    case "L4": return pc.green;
    case "L5": return pc.magenta;
  }
}

function severityColor(severity: string): (text: string) => string {
  switch (severity) {
    case "critical": return pc.red;
    case "high": return pc.red;
    case "medium": return pc.yellow;
    case "low": return pc.cyan;
    default: return pc.dim;
  }
}

function scoreBar(score: number, width: number = 20): string {
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;
  const color = score >= 81 ? pc.magenta : score >= 66 ? pc.green : score >= 46 ? pc.cyan : score >= 26 ? pc.yellow : pc.red;
  return color("\u2588".repeat(filled)) + pc.dim("\u2591".repeat(empty));
}

function formatPillar(pillar: PillarResult): string {
  const lines: string[] = [];
  const paddedName = pillar.name.padEnd(32);
  const scoreStr = String(pillar.score).padStart(3);
  const weightStr = `${Math.round(pillar.weight * 100)}%`.padStart(4);

  lines.push(
    `  ${pc.bold(pillar.pillar)} ${paddedName} ${scoreBar(pillar.score)} ${scoreStr}/100  (${pc.dim(weightStr)})`,
  );

  return lines.join("\n");
}

export function formatTerminal(result: ScanResult, options: TerminalOptions = {}): string {
  const lines: string[] = [];
  const colorFn = levelColor(result.level);

  // Header
  lines.push("");
  lines.push(pc.bold("  ARI Score Report"));
  lines.push(pc.dim(`  ${"─".repeat(60)}`));
  lines.push("");

  // Overall score
  lines.push(
    `  ${pc.bold("Score:")}    ${colorFn(pc.bold(String(result.score)))} / 100`,
  );
  lines.push(
    `  ${pc.bold("Level:")}    ${colorFn(pc.bold(`${result.level} — ${result.levelMeta.name}`))}`,
  );
  lines.push(
    `  ${pc.dim("           " + result.levelMeta.description)}`,
  );

  if (result.securityGateTriggered) {
    lines.push("");
    lines.push(
      `  ${pc.red(pc.bold("⚠ Security gate triggered:"))} Pillar 8 score < 40% — maturity capped at L2`,
    );
  }

  lines.push("");
  lines.push(pc.dim(`  ${"─".repeat(60)}`));
  lines.push(pc.bold("  Pillar Scores"));
  lines.push("");

  // Pillar scores
  for (const pillar of result.pillars) {
    lines.push(formatPillar(pillar));
  }

  // Top findings
  const topFindings = result.findings
    .filter((f) => f.severity === "critical" || f.severity === "high")
    .slice(0, 5);

  if (topFindings.length > 0) {
    lines.push("");
    lines.push(pc.dim(`  ${"─".repeat(60)}`));
    lines.push(pc.bold("  Top Findings"));
    lines.push("");

    for (const finding of topFindings) {
      const color = severityColor(finding.severity);
      lines.push(`  ${color(finding.severity.toUpperCase().padEnd(8))} ${pc.dim(finding.code)} ${finding.message}`);
      if (finding.remediation) {
        lines.push(`           ${pc.dim("→")} ${finding.remediation.description}`);
      }
      if (finding.file) {
        lines.push(`           ${pc.dim("in")} ${finding.file}${finding.line ? `:${finding.line}` : ""}`);
      }
    }
  }

  // Verbose: all findings
  if (options.verbose) {
    const remaining = result.findings.filter(
      (f) => f.severity !== "critical" && f.severity !== "high",
    );
    if (remaining.length > 0) {
      lines.push("");
      lines.push(pc.dim(`  ${"─".repeat(60)}`));
      lines.push(pc.bold("  All Findings"));
      lines.push("");

      for (const finding of remaining) {
        const color = severityColor(finding.severity);
        lines.push(`  ${color(finding.severity.toUpperCase().padEnd(8))} ${pc.dim(finding.code)} ${finding.message}`);
        if (finding.remediation) {
          lines.push(`           ${pc.dim("→")} ${finding.remediation.description}`);
        }
      }
    }
  }

  // Footer
  lines.push("");
  lines.push(pc.dim(`  ${"─".repeat(60)}`));
  lines.push(
    pc.dim(`  Scanned in ${result.metadata.duration}ms | ariscan v${result.metadata.version} | Rubric ${result.metadata.rubricVersion}`),
  );
  lines.push("");

  return lines.join("\n") + "\n";
}

import pc from "picocolors";
import type { ScanResult, PillarResult, MaturityLevel } from "@prontiq/schema";

interface TerminalOptions {
  verbose?: boolean;
  quiet?: boolean;
}

function levelColor(level: MaturityLevel): (text: string) => string {
  switch (level) {
    case "L1":
      return pc.red;
    case "L2":
      return pc.yellow;
    case "L3":
      return pc.cyan;
    case "L4":
      return pc.green;
    case "L5":
      return pc.magenta;
  }
}

function severityColor(severity: string): (text: string) => string {
  switch (severity) {
    case "critical":
      return pc.red;
    case "high":
      return pc.red;
    case "medium":
      return pc.yellow;
    case "low":
      return pc.cyan;
    default:
      return pc.dim;
  }
}

function scoreBar(score: number, width: number = 20): string {
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;
  const color =
    score >= 81
      ? pc.magenta
      : score >= 66
        ? pc.green
        : score >= 46
          ? pc.cyan
          : score >= 26
            ? pc.yellow
            : pc.red;
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
  // Quiet mode: single-line summary suitable for CI pipelines
  if (options.quiet) {
    const gate = result.securityGateTriggered ? " [SECURITY GATE]" : "";
    return `ARI ${result.score}/100 ${result.level} (${result.levelMeta.name})${gate}\n`;
  }

  const lines: string[] = [];
  const colorFn = levelColor(result.level);

  // Header
  lines.push("");
  lines.push(pc.bold("  ARI Score Report"));
  lines.push(pc.dim(`  ${"─".repeat(60)}`));
  lines.push("");

  // Overall score
  lines.push(`  ${pc.bold("Score:")}    ${colorFn(pc.bold(String(result.score)))} / 100`);
  lines.push(
    `  ${pc.bold("Level:")}    ${colorFn(pc.bold(`${result.level} — ${result.levelMeta.name}`))}`,
  );
  lines.push(`  ${pc.dim("           " + result.levelMeta.description)}`);

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
      lines.push(
        `  ${color(finding.severity.toUpperCase().padEnd(8))} ${pc.dim(finding.code)} ${finding.message}`,
      );
      if (finding.remediation) {
        lines.push(`           ${pc.dim("→")} ${finding.remediation.description}`);
      }
      if (finding.file) {
        lines.push(
          `           ${pc.dim("in")} ${finding.file}${finding.line ? `:${finding.line}` : ""}`,
        );
      }
    }
  }

  // Verbose: per-pillar summaries, detection info, and all findings
  if (options.verbose) {
    // Per-pillar summaries
    lines.push("");
    lines.push(pc.dim(`  ${"─".repeat(60)}`));
    lines.push(pc.bold("  Pillar Details"));
    lines.push("");

    for (const pillar of result.pillars) {
      lines.push(
        `  ${pc.bold(pillar.pillar)} ${pc.dim("confidence:")} ${pillar.confidence}  ${pc.dim("summary:")} ${pillar.summary}`,
      );
    }

    // Detection info
    if (result.detection) {
      lines.push("");
      lines.push(pc.dim(`  ${"─".repeat(60)}`));
      lines.push(pc.bold("  Detection"));
      lines.push("");

      if (result.detection.languages.length > 0) {
        const langs = result.detection.languages
          .map(
            (l) =>
              `${l.language} (${Math.round(l.confidence * 100)}%${l.primary ? ", primary" : ""})`,
          )
          .join(", ");
        lines.push(`  ${pc.dim("Languages:")} ${langs}`);
      }
      if (result.detection.frameworks.length > 0) {
        const fws = result.detection.frameworks
          .map((f) => `${f.framework} (${Math.round(f.confidence * 100)}%)`)
          .join(", ");
        lines.push(`  ${pc.dim("Frameworks:")} ${fws}`);
      }
      if (result.detection.monorepo) {
        lines.push(`  ${pc.dim("Monorepo:")} ${result.detection.monorepo.tool}`);
      }
    }

    // Context files
    if (result.contextFiles && result.contextFiles.length > 0) {
      lines.push("");
      lines.push(pc.dim(`  ${"─".repeat(60)}`));
      lines.push(pc.bold("  Context Files"));
      lines.push("");

      for (const cf of result.contextFiles) {
        const status = cf.parseStatus ? ` [${cf.parseStatus}]` : "";
        const size = cf.size ? ` (${cf.size} bytes)` : "";
        lines.push(`  ${pc.dim(cf.type.padEnd(22))} ${cf.path}${size}${status}`);
      }
    }

    // All remaining findings
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
        lines.push(
          `  ${color(finding.severity.toUpperCase().padEnd(8))} ${pc.dim(finding.code)} ${finding.message}`,
        );
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
    pc.dim(
      `  Scanned in ${result.metadata.duration}ms | ariscan v${result.metadata.version} | Rubric ${result.metadata.rubricVersion}`,
    ),
  );
  lines.push("");

  return lines.join("\n") + "\n";
}

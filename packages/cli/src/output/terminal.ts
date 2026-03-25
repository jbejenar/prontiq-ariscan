import pc from "picocolors";
import type { ScanResult, PillarResult, MaturityLevel } from "@prontiq/ariscan-schema";

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

function formatPillar(pillar: PillarResult, verbose?: boolean): string {
  const lines: string[] = [];
  const paddedName = pillar.name.padEnd(32);
  const weightStr = `${Math.round(pillar.weight * 100)}%`.padStart(4);

  if (pillar.dataStatus === "insufficient") {
    lines.push(
      `  ${pc.bold(pillar.pillar)} ${paddedName} ${pc.dim("░".repeat(20))} ${pc.dim("--/100")}  (${pc.dim(weightStr)})  ${pc.dim("INSUFFICIENT DATA")}`,
    );
  } else {
    const scoreStr = String(pillar.score).padStart(3);
    const partialLabel = pillar.dataStatus === "partial" ? `  ${pc.dim("PARTIAL DATA")}` : "";
    lines.push(
      `  ${pc.bold(pillar.pillar)} ${paddedName} ${scoreBar(pillar.score)} ${scoreStr}/100  (${pc.dim(weightStr)})${partialLabel}`,
    );
    if (verbose) {
      const contribution = (pillar.score * pillar.weight).toFixed(1);
      lines.push(
        `       ${pc.dim(`${pillar.score}/100 (${Math.round(pillar.weight * 100)}%) → contributes ${contribution} pts`)}`,
      );
    }
  }

  return lines.join("\n");
}

/** Format a single finding line with severity, code, confidence, and message. */
function formatFindingLine(finding: ScanResult["findings"][0]): string[] {
  const color = severityColor(finding.severity);
  const conf = finding.confidence ? pc.dim(` [${finding.confidence}]`) : "";
  const lines: string[] = [];
  lines.push(
    `  ${color(finding.severity.toUpperCase().padEnd(8))} ${pc.dim(finding.code)}${conf} ${finding.message}`,
  );
  if (finding.remediation) {
    lines.push(`           ${pc.dim("→")} ${finding.remediation.description}`);
  }
  if (finding.file) {
    lines.push(
      `           ${pc.dim("in")} ${finding.file}${finding.line ? `:${finding.line}` : ""}`,
    );
  }
  return lines;
}

function formatPillarDetails(pillars: ScanResult["pillars"]): string[] {
  const lines: string[] = [];
  lines.push("");
  lines.push(pc.dim(`  ${"─".repeat(60)}`));
  lines.push(pc.bold("  Pillar Details"));
  lines.push("");

  for (const pillar of pillars) {
    lines.push(
      `  ${pc.bold(pillar.pillar)} ${pc.dim("confidence:")} ${pillar.confidence}  ${pc.dim("summary:")} ${pillar.summary}`,
    );
    if (pillar.researchBasis && pillar.researchBasis.length > 0) {
      lines.push(`       ${pc.dim("research:")} ${pillar.researchBasis.join("; ")}`);
    }
  }
  return lines;
}

function formatContextFiles(contextFiles: ScanResult["contextFiles"]): string[] {
  if (!contextFiles || contextFiles.length === 0) return [];
  const lines: string[] = [];
  lines.push("");
  lines.push(pc.dim(`  ${"─".repeat(60)}`));
  lines.push(pc.bold("  Context Files"));
  lines.push("");

  for (const cf of contextFiles) {
    const status = cf.parseStatus ? ` [${cf.parseStatus}]` : "";
    const size = cf.size ? ` (${cf.size} bytes)` : "";
    lines.push(`  ${pc.dim(cf.type.padEnd(22))} ${cf.path}${size}${status}`);
  }
  return lines;
}

function formatRemainingFindings(findings: ScanResult["findings"]): string[] {
  const remaining = findings.filter((f) => f.severity !== "critical" && f.severity !== "high");
  if (remaining.length === 0) return [];
  const lines: string[] = [];
  lines.push("");
  lines.push(pc.dim(`  ${"─".repeat(60)}`));
  lines.push(pc.bold("  All Findings"));
  lines.push("");

  for (const finding of remaining) {
    const color = severityColor(finding.severity);
    const conf = finding.confidence ? pc.dim(` [${finding.confidence}]`) : "";
    lines.push(
      `  ${color(finding.severity.toUpperCase().padEnd(8))} ${pc.dim(finding.code)}${conf} ${finding.message}`,
    );
    if (finding.remediation) {
      lines.push(`           ${pc.dim("→")} ${finding.remediation.description}`);
    }
  }
  return lines;
}

/** Render the verbose details: per-pillar summaries, detection, context files, remaining findings. */
function formatVerboseSection(result: ScanResult): string[] {
  const lines: string[] = [];
  lines.push(...formatPillarDetails(result.pillars));
  if (result.detection) {
    lines.push(...formatDetectionSection(result.detection));
  }
  lines.push(...formatContextFiles(result.contextFiles));
  lines.push(...formatRemainingFindings(result.findings));
  return lines;
}

function formatLanguageLabel(l: {
  language: string;
  confidence: number;
  primary: boolean;
}): string {
  const pct = Math.round(l.confidence * 100);
  const primary = l.primary ? ", primary" : "";
  return `${l.language} (${pct}%${primary})`;
}

/** Render language/framework/monorepo detection info. */
function formatDetectionSection(detection: NonNullable<ScanResult["detection"]>): string[] {
  const lines: string[] = [];
  lines.push("");
  lines.push(pc.dim(`  ${"─".repeat(60)}`));
  lines.push(pc.bold("  Detection"));
  lines.push("");

  if (detection.languages.length > 0) {
    const langs = detection.languages.map(formatLanguageLabel).join(", ");
    lines.push(`  ${pc.dim("Languages:")} ${langs}`);
  }
  if (detection.frameworks.length > 0) {
    const fws = detection.frameworks
      .map((f) => `${f.framework} (${Math.round(f.confidence * 100)}%)`)
      .join(", ");
    lines.push(`  ${pc.dim("Frameworks:")} ${fws}`);
  }
  if (detection.monorepo) {
    lines.push(`  ${pc.dim("Monorepo:")} ${detection.monorepo.tool}`);
  }

  return lines;
}

function formatHeader(result: ScanResult): string[] {
  const colorFn = levelColor(result.level);
  const lines: string[] = [];
  lines.push("");
  lines.push(pc.bold("  ARI Score Report"));
  lines.push(pc.dim(`  ${"─".repeat(60)}`));
  lines.push("");
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
  return lines;
}

function formatTopFindingsSection(findings: ScanResult["findings"]): string[] {
  const topFindings = findings
    .filter((f) => f.severity === "critical" || f.severity === "high")
    .slice(0, 5);
  if (topFindings.length === 0) return [];

  const lines: string[] = [];
  lines.push("");
  lines.push(pc.dim(`  ${"─".repeat(60)}`));
  lines.push(pc.bold("  Top Findings"));
  lines.push("");

  for (const finding of topFindings) {
    lines.push(...formatFindingLine(finding));
  }
  return lines;
}

function formatScanFooter(metadata: ScanResult["metadata"]): string[] {
  return [
    "",
    pc.dim(`  ${"─".repeat(60)}`),
    pc.dim(
      `  Scanned in ${metadata.duration}ms | ariscan v${metadata.version} | Rubric ${metadata.rubricVersion}`,
    ),
    "",
  ];
}

export function formatTerminal(result: ScanResult, options: TerminalOptions = {}): string {
  if (options.quiet) {
    const gate = result.securityGateTriggered ? " [SECURITY GATE]" : "";
    return `ARI ${result.score}/100 ${result.level} (${result.levelMeta.name})${gate}\n`;
  }

  const lines: string[] = [];
  lines.push(...formatHeader(result));

  lines.push("");
  lines.push(pc.dim(`  ${"─".repeat(60)}`));
  lines.push(pc.bold("  Pillar Scores"));
  lines.push("");

  for (const pillar of result.pillars) {
    lines.push(formatPillar(pillar, options.verbose));
  }

  if (result.scoreBreakdown && result.scoreBreakdown.insufficientPillars > 0) {
    lines.push("");
    lines.push(
      pc.dim(
        `  ${result.scoreBreakdown.activePillars} active pillars, ${result.scoreBreakdown.insufficientPillars} insufficient (excluded from composite)`,
      ),
    );
  }

  lines.push(...formatTopFindingsSection(result.findings));

  if (options.verbose) {
    lines.push(...formatVerboseSection(result));
  }

  lines.push(...formatScanFooter(result.metadata));

  return lines.join("\n") + "\n";
}

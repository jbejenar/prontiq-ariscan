/**
 * `ariscan audit agents-md` subcommand (P2.02)
 *
 * Produces a detailed quality report for existing context files
 * covering 7 scoring dimensions with severity-ranked issues and fix examples.
 */

import { defineCommand } from "citty";
import { resolve } from "node:path";
import { access } from "node:fs/promises";
import { createRepoContext, detect, auditAgentsMd } from "@prontiq/ariscan-engine";
import type { AuditResult, AuditIssue, IssueSeverity } from "@prontiq/ariscan-engine";

function severityIcon(severity: IssueSeverity): string {
  switch (severity) {
    case "critical":
      return "✗";
    case "warning":
      return "⚠";
    case "info":
      return "ℹ";
  }
}

function formatTerminalReport(results: AuditResult[]): string {
  const lines: string[] = [];

  if (results.length === 0) {
    lines.push("\n✗ No context files found to audit.");
    lines.push("  Run `ariscan generate .` to create one.\n");
    return lines.join("\n");
  }

  for (const result of results) {
    lines.push(`\n━━━ Audit: ${result.filePath} ━━━`);
    lines.push(`    Overall score: ${result.overallScore}/100`);
    lines.push(`    Token estimate: ~${result.tokenEstimate.toLocaleString()} tokens\n`);

    // Dimensions
    lines.push("  Dimensions:");
    for (const dim of result.dimensions) {
      const bar = scoreBar(dim.score);
      lines.push(`    ${bar} ${dim.label}: ${dim.score}/100`);
      lines.push(`         ${dim.details}`);
    }

    // Issues
    if (result.issues.length > 0) {
      lines.push(`\n  Issues (${result.issues.length}):`);
      for (const issue of result.issues) {
        const icon = severityIcon(issue.severity);
        const lineRef = issue.line ? ` (line ${issue.line})` : "";
        lines.push(`    ${icon} [${issue.severity}] ${issue.message}${lineRef}`);
        if (issue.fix) {
          lines.push(`      Fix: ${issue.fix}`);
        }
      }
    } else {
      lines.push("\n  No issues found.");
    }

    // Redundancy details
    if (result.redundancy.redundancyPct >= 0) {
      lines.push(`\n  Redundancy: ${result.redundancy.redundancyPct.toFixed(1)}%`);
      if (result.redundancy.duplicateLines.length > 0) {
        const sources = [...new Set(result.redundancy.duplicateLines.map((d) => d.matchedIn))];
        lines.push(`  Overlaps with: ${sources.join(", ")}`);
      }
    }

    lines.push("");
  }

  return lines.join("\n");
}

function scoreBar(score: number): string {
  const filled = Math.round(score / 10);
  const empty = 10 - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

function formatJsonReport(results: AuditResult[]): string {
  return JSON.stringify(
    results.map((r) => ({
      filePath: r.filePath,
      overallScore: r.overallScore,
      tokenEstimate: r.tokenEstimate,
      dimensions: r.dimensions,
      issues: r.issues.map((i: AuditIssue) => ({
        severity: i.severity,
        dimension: i.dimension,
        message: i.message,
        line: i.line ?? null,
        fix: i.fix ?? null,
      })),
      redundancy: {
        redundancyPct: r.redundancy.redundancyPct,
        additionalityPct: r.redundancy.additionalityPct,
        duplicateLines: r.redundancy.duplicateLines,
        additiveLines: r.redundancy.additiveLines.length,
      },
    })),
    null,
    2,
  );
}

/** Recognized audit targets — bare words that are NOT filesystem paths */
const AUDIT_TARGETS = new Set(["agents-md"]);

export const auditCommand = defineCommand({
  meta: {
    name: "audit",
    description: "Audit context file quality (agents-md)",
  },
  args: {
    path: {
      type: "positional",
      description:
        "Audit target or repository path. Use 'agents-md' to audit context files, or provide a repo path (default: 'agents-md' target in current directory)",
      required: false,
      default: ".",
    },
    json: {
      type: "boolean",
      description: "Output as JSON",
      default: false,
    },
    quiet: {
      type: "boolean",
      description: "Suppress progress output",
      default: false,
    },
  },
  async run({ args }) {
    let repoPath: string;

    // If the positional arg is a recognized audit target (e.g. "agents-md"),
    // treat it as a target keyword and default the repo path to "."
    if (AUDIT_TARGETS.has(args.path as string)) {
      repoPath = resolve(".");
    } else {
      repoPath = resolve(args.path as string);
    }

    try {
      await access(repoPath);
    } catch {
      process.stderr.write(`Error: Path does not exist: ${repoPath}\n`);
      process.exit(2);
    }

    try {
      if (!args.quiet) {
        process.stderr.write(`\nAuditing context files in ${repoPath}...\n`);
      }

      const context = await createRepoContext(repoPath);
      const detection = await detect(context);
      const results = await auditAgentsMd(context, detection);

      if (args.json) {
        process.stdout.write(formatJsonReport(results));
        process.stdout.write("\n");
      } else {
        process.stdout.write(formatTerminalReport(results));
      }

      // Exit with non-zero if any critical issues found
      const hasCritical = results.some((r) => r.issues.some((i) => i.severity === "critical"));
      if (hasCritical) {
        process.exit(1);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Error: Audit failed: ${message}\n`);
      process.exit(2);
    }
  },
});

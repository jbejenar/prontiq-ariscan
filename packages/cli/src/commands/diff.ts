/**
 * `ariscan diff context` subcommand (P2.03)
 *
 * Shows additive vs duplicative content across all context files,
 * with three-way comparison (context ↔ other context ↔ repo docs)
 * and deduplication recommendations.
 */

import { defineCommand } from "citty";
import { resolve } from "node:path";
import { access } from "node:fs/promises";
import { createRepoContext, detect, diffContext } from "@prontiq/ariscan-engine";
import type {
  DiffResult,
  ContextFileDiff,
  DeduplicationRecommendation,
} from "@prontiq/ariscan-engine";

// ─── Terminal formatting ─────────────────────────────────────────────────

function colorGreen(text: string): string {
  return `\x1b[32m${text}\x1b[0m`;
}

function colorRed(text: string): string {
  return `\x1b[31m${text}\x1b[0m`;
}

function colorYellow(text: string): string {
  return `\x1b[33m${text}\x1b[0m`;
}

function colorDim(text: string): string {
  return `\x1b[2m${text}\x1b[0m`;
}

function colorBold(text: string): string {
  return `\x1b[1m${text}\x1b[0m`;
}

function pctBar(pct: number, width: number = 28): string {
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

function formatTerminalDiff(result: DiffResult): string {
  const lines: string[] = [];

  if (result.totalFiles === 0) {
    lines.push("\n✗ No context files found.");
    lines.push("  Run `ariscan generate .` to create one.\n");
    return lines.join("\n");
  }

  lines.push(`\n${colorBold("━━━ Context File Delta Analysis ━━━")}`);
  lines.push("");
  lines.push(`  Found ${result.totalFiles} context file(s):`);
  for (const file of result.files) {
    lines.push(`    ${file.path} (${file.tokenEstimate.toLocaleString()} tokens)`);
  }
  lines.push("");

  for (const file of result.files) {
    lines.push(`  ${colorBold(`── ${file.path} ──`)}`);
    lines.push(
      `    ${colorGreen("Additive (unique):")}     ${file.additivePct.toFixed(1).padStart(5)}%  ${pctBar(file.additivePct)}`,
    );
    lines.push(
      `    ${colorRed("Duplicates repo docs:")} ${file.duplicativeRepoPct.toFixed(1).padStart(5)}%  ${pctBar(file.duplicativeRepoPct)}`,
    );
    lines.push(
      `    ${colorRed("Duplicates other ctx:")} ${file.duplicativeContextPct.toFixed(1).padStart(5)}%  ${pctBar(file.duplicativeContextPct)}`,
    );
    lines.push(
      `    ${colorYellow("Overlapping:")}          ${file.overlappingPct.toFixed(1).padStart(5)}%  ${pctBar(file.overlappingPct)}`,
    );

    // Show duplicated sections details
    const dupSegments = file.segments.filter(
      (s) => s.classification === "duplicative-repo" || s.classification === "duplicative-context",
    );
    if (dupSegments.length > 0) {
      lines.push("");
      lines.push("    Duplicated sections:");
      const shown = new Set<string>();
      for (const seg of dupSegments) {
        const key = `${seg.matchedIn ?? "unknown"}`;
        if (shown.has(key)) continue;
        shown.add(key);
        const label = seg.classification === "duplicative-context" ? "also in" : "overlaps with";
        lines.push(
          `      ${colorRed("✗")} ${colorDim(`"${truncate(seg.text, 50)}" ${label} ${seg.matchedIn ?? "unknown"}`)}`,
        );
        if (shown.size >= 5) {
          const remaining = dupSegments.filter((s) => !shown.has(s.matchedIn ?? "unknown")).length;
          if (remaining > 0) {
            lines.push(`      ${colorDim(`  ... and ${remaining} more`)}`);
          }
          break;
        }
      }
    }

    lines.push("");
  }

  // Recommendations
  if (result.recommendations.length > 0) {
    lines.push(`  ${colorBold("── Recommendations ──")}`);
    for (let i = 0; i < result.recommendations.length; i++) {
      const rec = result.recommendations[i] as DeduplicationRecommendation;
      lines.push(`    ${i + 1}. ${rec.description}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}

// ─── JSON formatting ─────────────────────────────────────────────────────

function formatJsonDiff(result: DiffResult): string {
  return JSON.stringify(
    {
      $schema: "https://prontiq.dev/schemas/ari-context-diff/v1.json",
      totalFiles: result.totalFiles,
      files: result.files.map((f: ContextFileDiff) => ({
        path: f.path,
        tokenEstimate: f.tokenEstimate,
        additivePct: f.additivePct,
        duplicativeRepoPct: f.duplicativeRepoPct,
        duplicativeContextPct: f.duplicativeContextPct,
        overlappingPct: f.overlappingPct,
        segments: f.segments.map((s) => ({
          text: s.text,
          classification: s.classification,
          matchedIn: s.matchedIn ?? null,
          similarity: Math.round(s.similarity * 1000) / 1000,
        })),
      })),
      recommendations: result.recommendations.map((r: DeduplicationRecommendation) => ({
        action: r.action,
        description: r.description,
        files: r.files,
        overlapPct: r.overlapPct,
      })),
    },
    null,
    2,
  );
}

// ─── Command ─────────────────────────────────────────────────────────────

export const diffCommand = defineCommand({
  meta: {
    name: "diff",
    description: "Compare context files for overlap and redundancy (diff context)",
  },
  args: {
    path: {
      type: "positional",
      description: "Repository path (default: current directory)",
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
    // The first positional might be "context" — treat it as the subcommand and use "." as path
    let repoPath: string;
    if (args.path === "context") {
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
        process.stderr.write(`\nAnalyzing context file delta in ${repoPath}...\n`);
      }

      const context = await createRepoContext(repoPath);
      const detection = await detect(context);
      const result = await diffContext(context, detection);

      if (args.json) {
        process.stdout.write(formatJsonDiff(result));
        process.stdout.write("\n");
      } else {
        process.stdout.write(formatTerminalDiff(result));
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Error: Context diff failed: ${message}\n`);
      process.exit(2);
    }
  },
});

/**
 * `ariscan generate` subcommand (P2.01)
 *
 * Generates AGENTS.md files with measurably higher additionality than
 * naive generation. Uses gap analysis to determine what's missing,
 * then produces only additive content.
 */

import { defineCommand } from "citty";
import { resolve } from "node:path";
import { access, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import {
  createRepoContext,
  detect,
  generateContextFiles,
  analyzeGaps,
} from "@prontiq/ariscan-engine";
import type { GenerateResult, GapAnalysisResult } from "@prontiq/ariscan-engine";

function formatGapReport(gapAnalysis: GapAnalysisResult): string {
  const lines: string[] = [];
  lines.push("\n📋 Gap Analysis Report");
  lines.push(`   Indexed ${gapAnalysis.indexed.length} document(s)`);
  lines.push(`   Coverage: ${gapAnalysis.coverage}%`);

  if (gapAnalysis.gaps.length > 0) {
    lines.push(`\n   Gaps found (${gapAnalysis.gaps.length}):`);
    for (const gap of gapAnalysis.gaps) {
      const icon = gap.foundIn ? "⚠" : "✗";
      lines.push(`   ${icon} [importance: ${gap.category.importance}/10] ${gap.description}`);
    }
  } else {
    lines.push("\n   No gaps found — documentation is comprehensive.");
  }

  return lines.join("\n");
}

function formatGenerateResult(result: GenerateResult): string {
  const lines: string[] = [];

  if (result.files.length === 0) {
    lines.push("\n✓ No generation needed — existing documentation covers all categories.");
    return lines.join("\n");
  }

  lines.push(`\n📝 Generated ${result.files.length} file(s):\n`);

  for (const file of result.files) {
    lines.push(`   ${file.path}`);
    lines.push(`     Additionality: ${file.additionality.toFixed(1)}%`);
    lines.push(`     Redundancy:    ${file.redundancy.toFixed(1)}%`);
    lines.push(`     Front-loading: ${file.frontLoadScore}%`);

    const rationaleKeys = Object.keys(file.rationale);
    if (rationaleKeys.length > 0) {
      lines.push(`     Sections (${rationaleKeys.length}):`);
      for (const key of rationaleKeys) {
        lines.push(`       - ${key}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

function formatJsonResult(result: GenerateResult): string {
  return JSON.stringify(
    {
      files: result.files.map((f) => ({
        path: f.path,
        additionality: f.additionality,
        redundancy: f.redundancy,
        frontLoadScore: f.frontLoadScore,
        rationale: f.rationale,
        contentLength: f.content.length,
        lineCount: f.content.split("\n").length,
      })),
      gapAnalysis: {
        indexed: result.gapAnalysis.indexed,
        gaps: result.gapAnalysis.gaps.map((g) => ({
          categoryId: g.category.id,
          categoryLabel: g.category.label,
          importance: g.category.importance,
          description: g.description,
          foundIn: g.foundIn,
          adequate: g.adequate,
        })),
        coverage: result.gapAnalysis.coverage,
      },
    },
    null,
    2,
  );
}

export const generateCommand = defineCommand({
  meta: {
    name: "generate",
    description: "Generate AGENTS.md with measurably higher additionality than naive generation",
  },
  args: {
    path: {
      type: "positional",
      description: "Path to the repository (default: current directory)",
      required: false,
      default: ".",
    },
    json: {
      type: "boolean",
      description: "Output as JSON (machine-readable)",
      default: false,
    },
    dryRun: {
      type: "boolean",
      description: "Preview generated content without writing files",
      default: false,
    },
    gapOnly: {
      type: "boolean",
      description: "Only show gap analysis, do not generate files",
      default: false,
    },
    quiet: {
      type: "boolean",
      description: "Suppress progress output",
      default: false,
    },
  },
  async run({ args }) {
    const repoPath = resolve(args.path as string);
    try {
      await access(repoPath);
    } catch {
      process.stderr.write(`Error: Path does not exist: ${repoPath}\n`);
      process.exit(2);
    }

    try {
      if (!args.quiet) {
        process.stderr.write(`\nAnalyzing ${repoPath}...\n`);
      }

      const context = await createRepoContext(repoPath);
      const detection = await detect(context);

      // Gap-only mode
      if (args.gapOnly) {
        const gapAnalysis = await analyzeGaps(context, detection);
        if (args.json) {
          process.stdout.write(
            JSON.stringify(
              {
                indexed: gapAnalysis.indexed,
                gaps: gapAnalysis.gaps.map((g) => ({
                  categoryId: g.category.id,
                  categoryLabel: g.category.label,
                  importance: g.category.importance,
                  description: g.description,
                  foundIn: g.foundIn,
                  adequate: g.adequate,
                })),
                coverage: gapAnalysis.coverage,
              },
              null,
              2,
            ),
          );
        } else {
          process.stdout.write(formatGapReport(gapAnalysis));
          process.stdout.write("\n");
        }
        return;
      }

      // Full generate mode
      const result = await generateContextFiles(context, detection);

      if (args.json) {
        process.stdout.write(formatJsonResult(result));
        process.stdout.write("\n");
        return;
      }

      // Terminal output
      process.stdout.write(formatGapReport(result.gapAnalysis));
      process.stdout.write(formatGenerateResult(result));

      if (result.files.length === 0) {
        process.stdout.write("\n");
        return;
      }

      if (args.dryRun) {
        process.stdout.write("--- Dry run: no files written ---\n\n");
        for (const file of result.files) {
          process.stdout.write(`=== ${file.path} ===\n`);
          process.stdout.write(file.content);
          process.stdout.write("\n");
        }
        return;
      }

      // Write files
      let written = 0;
      let skipped = 0;
      for (const file of result.files) {
        const filePath = resolve(repoPath, file.path);
        try {
          await access(filePath);
          // File exists — skip
          if (!args.quiet) {
            process.stderr.write(`   Skipped ${file.path} (already exists)\n`);
          }
          skipped++;
          continue;
        } catch {
          // File doesn't exist — write it
        }

        const dir = dirname(filePath);
        await mkdir(dir, { recursive: true });
        await writeFile(filePath, file.content, "utf-8");
        if (!args.quiet) {
          process.stderr.write(`   Created ${file.path}\n`);
        }
        written++;
      }

      process.stderr.write(`\nDone: ${written} created, ${skipped} skipped.\n`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Error: Generation failed: ${message}\n`);
      process.exit(2);
    }
  },
});

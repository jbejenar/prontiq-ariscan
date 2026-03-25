/**
 * `ariscan check` subcommand (P3.04 — Pre-commit Check Mode).
 *
 * Speed-optimized scan for pre-commit hooks and local development.
 * Only reports regressions when a baseline exists.
 */
import { defineCommand } from "citty";
import { resolve } from "node:path";
import { access } from "node:fs/promises";
import pc from "picocolors";
import {
  runCheck,
  getChangedFiles,
  saveBaseline,
  getBaselineCacheDir,
} from "@prontiq/ariscan-engine";
import type { CheckResult, DeltaResult } from "@prontiq/ariscan-engine";
import { PILLAR_NAMES } from "@prontiq/ariscan-schema";
import type { CheckProfile } from "@prontiq/ariscan-schema";

export const checkCommand = defineCommand({
  meta: {
    name: "check",
    description: `Speed-optimized readiness check for pre-commit hooks

Profiles:
  fast      Config files, dev environment, security (<5s target)
  standard  + type safety, tests, navigability (<15s target)
  thorough  Full scan, same as CI

Examples:
  ariscan check .                          # Fast check (default)
  ariscan check . --mode standard          # Standard depth
  ariscan check . --save-baseline          # Save current as baseline
  ariscan check . --mode thorough --json   # Full scan, JSON output`,
  },
  args: {
    path: {
      type: "positional",
      description: "Path to the repository (default: current directory)",
      required: false,
      default: ".",
    },
    mode: {
      type: "string",
      description: "Check profile: fast, standard, thorough (default: fast)",
      default: "fast",
    },
    saveBaseline: {
      type: "boolean",
      description: "Save current result as the baseline for future delta comparisons",
      default: false,
    },
    noDelta: {
      type: "boolean",
      description: "Skip delta comparison against baseline",
      default: false,
    },
    changedOnly: {
      type: "boolean",
      description: "Only report findings on git-changed files (default: true)",
      default: true,
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
    const profile = validateProfile(args.mode);
    const repoPath = await validatePath(args.path);

    if (!args.quiet && !args.json) {
      process.stderr.write(
        `\n${pc.bold("ariscan check")} · ${pc.cyan(profile)} profile · ${repoPath}\n`,
      );
    }

    // Detect changed files if requested
    const changedFiles = args.changedOnly ? await getChangedFiles(repoPath) : [];

    if (!args.quiet && !args.json && changedFiles.length > 0) {
      process.stderr.write(`  ${changedFiles.length} changed file(s) detected\n`);
    }

    const startTime = performance.now();

    const result = await runCheck(repoPath, {
      profile,
      changedFiles: args.changedOnly ? changedFiles : undefined,
      useDelta: !args.noDelta,
      onProgress:
        !args.quiet && !args.json
          ? (event) => {
              const name = PILLAR_NAMES[event.pillar] ?? event.pillar;
              if (event.status === "done") {
                process.stderr.write(`  ✓ ${event.pillar} ${name} (${event.elapsed}ms)\n`);
              }
            }
          : undefined,
    });

    const elapsed = Math.round(performance.now() - startTime);

    // Save baseline if requested (always uses full unfiltered scan result)
    if (args.saveBaseline) {
      await saveBaseline(repoPath, result.scanResult);
      if (!args.quiet && !args.json) {
        process.stderr.write(`\n  Baseline saved to ${getBaselineCacheDir()}/baseline.json\n`);
      }
    }

    const isFiltered = result.changedFiles.length > 0;

    // Output
    if (args.json) {
      process.stdout.write(
        JSON.stringify(
          {
            profile: result.profile,
            composite: result.scanResult.score,
            level: result.scanResult.level,
            scoreScope: "full-repo",
            findingsScope: isFiltered ? "changed-files" : "full-repo",
            delta: result.delta,
            changedFiles: result.changedFiles,
            pillars: result.filteredPillars.map((p) => ({
              pillar: p.pillar,
              score: p.score,
              findingCount: p.findings.length,
            })),
            elapsed,
          },
          null,
          2,
        ),
      );
    } else {
      process.stdout.write(formatCheckTerminal(result, elapsed));
    }

    // Exit with code 1 if there are regressions
    if (result.delta?.hasRegressions) {
      process.exit(1);
    }
  },
});

function validateProfile(mode: string): CheckProfile {
  if (mode === "fast" || mode === "standard" || mode === "thorough") {
    return mode;
  }
  process.stderr.write(`Error: Invalid check mode "${mode}". Use: fast, standard, thorough\n`);
  process.exit(2);
}

async function validatePath(path: string): Promise<string> {
  const repoPath = resolve(path);
  try {
    await access(repoPath);
  } catch {
    process.stderr.write(`Error: Path does not exist: ${repoPath}\n`);
    process.exit(2);
  }
  return repoPath;
}

function formatCheckTerminal(result: CheckResult, elapsed: number): string {
  const lines: string[] = [];
  const { scanResult, delta, filteredPillars } = result;
  const isFiltered = result.changedFiles.length > 0;

  lines.push("");

  if (delta) {
    // Delta mode: show regressions only
    lines.push(formatDeltaOutput(delta, scanResult.score, scanResult.level));
  } else {
    // No baseline: show summary
    lines.push(`  ${pc.bold("Score:")} ${colorScore(scanResult.score)}/100 (${scanResult.level})`);
    if (isFiltered) {
      lines.push(pc.dim("  Score reflects full repo; findings scoped to changed files"));
    }
    lines.push("");

    // Show pillar scores (use filtered pillars for finding counts)
    for (const pillar of filteredPillars) {
      const name = PILLAR_NAMES[pillar.pillar] ?? pillar.pillar;
      const findingCount = pillar.findings.length;
      const findingNote =
        findingCount > 0 ? pc.dim(` (${findingCount} finding${findingCount > 1 ? "s" : ""})`) : "";
      lines.push(
        `  ${pillar.pillar} ${name.padEnd(30)} ${colorScore(pillar.score).padStart(3)}${findingNote}`,
      );
    }

    lines.push("");
    lines.push(
      pc.dim(`  No baseline found. Run with --save-baseline to enable delta comparisons.`),
    );
  }

  lines.push("");
  lines.push(pc.dim(`  ${result.profile} profile · ${elapsed}ms`));
  lines.push("");

  return lines.join("\n");
}

function formatDeltaOutput(delta: DeltaResult, composite: number, level: string): string {
  const lines: string[] = [];
  const arrow = delta.compositeDelta >= 0 ? "↑" : "↓";
  const deltaColor = delta.compositeDelta >= 0 ? pc.green : pc.red;
  const deltaStr =
    delta.compositeDelta >= 0
      ? `+${delta.compositeDelta.toFixed(1)}`
      : delta.compositeDelta.toFixed(1);

  lines.push(
    `  ${pc.bold("Score:")} ${colorScore(composite)}/100 (${level}) ${deltaColor(`${arrow} ${deltaStr}`)}`,
  );
  lines.push("");

  if (!delta.hasRegressions) {
    lines.push(`  ${pc.green("✓ No regressions detected")}`);
    return lines.join("\n");
  }

  // Show regressions
  lines.push(`  ${pc.red("⚠ Regressions detected:")}`);
  lines.push("");

  for (const pillar of delta.pillars) {
    if (pillar.delta < 0 || pillar.newFindings.length > 0) {
      const name = PILLAR_NAMES[pillar.pillar] ?? pillar.pillar;
      const scoreDelta = pillar.delta < 0 ? pc.red(`${pillar.delta.toFixed(1)}`) : "";
      lines.push(`  ${pillar.pillar} ${name}: ${pillar.scoreAfter} ${scoreDelta}`);
      for (const finding of pillar.newFindings) {
        lines.push(
          `    ${pc.red("NEW")} ${finding.code} ${finding.message}${finding.file ? ` (${finding.file})` : ""}`,
        );
      }
    }
  }

  // Show improvements (compact)
  const improvements = delta.pillars.filter((p) => p.delta > 0 || p.resolvedFindings.length > 0);
  if (improvements.length > 0) {
    lines.push("");
    lines.push(`  ${pc.green("Improvements:")}`);
    for (const pillar of improvements) {
      const name = PILLAR_NAMES[pillar.pillar] ?? pillar.pillar;
      lines.push(
        `    ${pillar.pillar} ${name}: +${pillar.delta.toFixed(1)} (${pillar.resolvedFindings.length} resolved)`,
      );
    }
  }

  return lines.join("\n");
}

function colorScore(score: number): string {
  if (score >= 81) return pc.green(String(score));
  if (score >= 66) return pc.cyan(String(score));
  if (score >= 46) return pc.yellow(String(score));
  return pc.red(String(score));
}

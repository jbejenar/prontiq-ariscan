import { defineCommand, runMain } from "citty";
import { resolve } from "node:path";
import { access, writeFile } from "node:fs/promises";
import {
  scan,
  createRepoContext,
  analyzeTokenBudget,
  detect,
  generateFixProposals,
  buildTelemetryPayload,
  sendTelemetry,
} from "@prontiq/ariscan-engine";
import type { FixProposal, OnProgress } from "@prontiq/ariscan-engine";
import { handleTelemetrySet, handleTelemetryShow } from "./commands/config.js";
import { formatTerminal } from "./output/terminal.js";
import { formatJson, formatNdjson, formatJsonSchema } from "./output/json.js";
import { formatMarkdown } from "./output/markdown.js";
import { formatSarif } from "./output/sarif.js";
import { generateBadgeSvg, generateBadgeSnippets } from "./output/badge.js";
import { formatBudgetTerminal, formatBudgetJson } from "./output/budget.js";
import { resolveConfig } from "./config-loader.js";
import { PILLAR_NAMES } from "@prontiq/ariscan-schema";
import type { ScanResult } from "@prontiq/ariscan-schema";

async function resolveRepoPath(path: string): Promise<string> {
  const repoPath = resolve(path);
  try {
    await access(repoPath);
  } catch {
    process.stderr.write(`Error: Path does not exist: ${repoPath}\n`);
    process.exit(2);
  }
  return repoPath;
}

async function handleFlagCommands(args: Record<string, unknown>): Promise<boolean> {
  if (args.telemetryShow) {
    await handleTelemetryShow();
    return true;
  }
  if (args.telemetry) {
    await handleTelemetrySet(args.telemetry as string);
    return true;
  }
  if (args.jsonSchema) {
    process.stdout.write(formatJsonSchema());
    return true;
  }
  return false;
}

async function handleRepoCommands(
  repoPath: string,
  args: Record<string, unknown>,
): Promise<boolean> {
  if (args.budget) {
    await handleBudgetMode(repoPath, args.json as boolean, args.quiet as boolean);
    return true;
  }
  if (args.fix) {
    await handleFixMode(
      repoPath,
      args.force as boolean,
      args.dryRun as boolean,
      args.quiet as boolean,
    );
    return true;
  }
  return false;
}

async function dispatchCommand(args: Record<string, unknown>): Promise<void> {
  if (await handleFlagCommands(args)) return;

  const repoPath = await resolveRepoPath(args.path as string);
  if (await handleRepoCommands(repoPath, args)) return;

  if (args.noTelemetry) {
    process.env["ARISCAN_TELEMETRY"] = "false";
  }
  await handleScanMode(repoPath, args as Parameters<typeof handleScanMode>[1]);
}

const main = defineCommand({
  meta: {
    name: "ariscan",
    version: "0.1.0",
    description: `Measure and improve repository readiness for AI coding agents

Examples:
  npx @prontiq/ariscan-cli .                    # Scan current directory
  npx @prontiq/ariscan-cli /path/to/repo --json # JSON output
  npx @prontiq/ariscan-cli . --threshold 60     # Fail if score < 60
  npx @prontiq/ariscan-cli . --format sarif     # SARIF output for Code Scanning
  npx @prontiq/ariscan-cli . --badge badge.svg  # Generate badge SVG
  npx @prontiq/ariscan-cli . --budget           # Analyze token budget
  npx @prontiq/ariscan-cli . --fix              # Generate missing config files
  npx @prontiq/ariscan-cli . --fix --dry-run   # Preview changes without writing
  npx @prontiq/ariscan-cli . --fix --force     # Overwrite existing files

Exit codes:
  0  Score meets or exceeds threshold (default: 0)
  1  Score is below the specified --threshold
  2  Runtime error (path not found, scan failure)`,
  },
  args: {
    path: {
      type: "positional",
      description: "Path to the repository to scan (default: current directory)",
      required: false,
      default: ".",
    },
    format: {
      type: "string",
      description: "Output format: terminal, json, ndjson, sarif, markdown",
      default: "terminal",
    },
    json: {
      type: "boolean",
      description: "Output as JSON (shorthand for --format json)",
      default: false,
    },
    verbose: {
      type: "boolean",
      description: "Show detailed analysis for each pillar",
      default: false,
    },
    quiet: {
      type: "boolean",
      description: "Suppress progress output",
      default: false,
    },
    threshold: {
      type: "string",
      description: "Minimum passing score (exit code 1 if below)",
      default: "0",
    },
    config: {
      type: "string",
      description: "Path to .ariscan.yml config file",
      required: false,
    },
    jsonSchema: {
      type: "boolean",
      description: "Print the JSON Schema for scan output and exit",
      default: false,
    },
    badge: {
      type: "string",
      description: "Generate an SVG badge file at the given path (e.g. badge.svg)",
      required: false,
    },
    budget: {
      type: "boolean",
      description: "Analyze token budget: estimate context window cost by file category",
      default: false,
    },
    fix: {
      type: "boolean",
      description: "Generate missing config files (AGENTS.md, .agentignore, .devcontainer)",
      default: false,
    },
    dryRun: {
      type: "boolean",
      description: "Preview --fix changes without writing files",
      default: false,
    },
    force: {
      type: "boolean",
      description: "With --fix: overwrite existing files (requires explicit opt-in)",
      default: false,
    },
    telemetry: {
      type: "string",
      description: "Set telemetry consent: true or false",
      required: false,
    },
    telemetryShow: {
      type: "boolean",
      description: "Show what telemetry data would be sent",
      default: false,
    },
    noTelemetry: {
      type: "boolean",
      description: "Disable telemetry for this single run",
      default: false,
    },
  },
  async run({ args }) {
    await dispatchCommand(args);
  },
});

/** Handle --budget mode: analyze token budget and exit. */
async function handleBudgetMode(repoPath: string, json: boolean, quiet: boolean): Promise<void> {
  if (!quiet) {
    process.stderr.write(`\nAnalyzing token budget for ${repoPath}...\n`);
  }
  try {
    const context = await createRepoContext(repoPath);
    const budgetResult = await analyzeTokenBudget(context);
    if (json) {
      process.stdout.write(formatBudgetJson(budgetResult));
    } else {
      process.stdout.write(formatBudgetTerminal(budgetResult));
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: Budget analysis failed: ${message}\n`);
    process.exit(2);
  }
}

/** Handle --fix mode: generate missing config files. */
async function handleFixMode(
  repoPath: string,
  force: boolean,
  dryRun: boolean,
  quiet: boolean,
): Promise<void> {
  if (!quiet) {
    process.stderr.write(`\nGenerating fix proposals for ${repoPath}...\n`);
  }
  try {
    const context = await createRepoContext(repoPath);
    const detection = await detect(context);
    const proposals = await generateFixProposals(context, detection);

    const forceMode = force === true;
    const actionable = proposals.filter((p) => !p.alreadyExists);
    const overwrites = forceMode ? proposals.filter((p) => p.alreadyExists) : [];
    const skipped = forceMode ? [] : proposals.filter((p) => p.alreadyExists);

    if (actionable.length === 0 && overwrites.length === 0) {
      process.stderr.write("\nAll files already exist. Nothing to generate.\n");
      if (!forceMode && proposals.some((p) => p.alreadyExists)) {
        process.stderr.write("Use --fix --force to overwrite existing files.\n");
      }
      return;
    }

    if (dryRun) {
      process.stdout.write(formatDryRun(actionable, skipped, overwrites));
    } else {
      await applyProposals(repoPath, actionable, skipped, quiet, overwrites);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: Fix generation failed: ${message}\n`);
    process.exit(2);
  }
}

/** Handle default scan mode: scan, format output, apply threshold. */
async function handleScanMode(
  repoPath: string,
  args: {
    json: boolean;
    format: string;
    config?: string;
    threshold: string;
    quiet: boolean;
    verbose: boolean;
    badge?: string;
  },
): Promise<void> {
  const cliOverrides: Record<string, unknown> = {};
  const cliThreshold = parseInt(args.threshold, 10);
  if (cliThreshold > 0) {
    cliOverrides.threshold = cliThreshold;
  }
  if (args.json) {
    cliOverrides.format = "json";
  } else if (args.format !== "terminal") {
    cliOverrides.format = args.format;
  }

  const config = await resolveConfig({
    repoPath,
    configPath: args.config,
    cliOverrides,
  });

  const format = args.json ? "json" : (config.format ?? args.format);

  if (!args.quiet && format === "terminal") {
    process.stderr.write(`\nScanning ${repoPath}...\n`);
  }

  const showProgress = !args.quiet && format === "terminal";
  const onProgress: OnProgress | undefined = showProgress
    ? (event) => {
        const name = PILLAR_NAMES[event.pillar] ?? event.pillar;
        if (event.status === "done") {
          process.stderr.write(`  ✓ ${event.pillar} ${name} (${event.elapsed}ms)\n`);
        }
      }
    : undefined;

  let result: ScanResult;
  try {
    result = await scan(repoPath, config, onProgress);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: Scan failed: ${message}\n`);
    process.exit(2);
  }

  let badgeGenerated = false;
  if (args.badge) {
    const badgePath = resolve(args.badge);
    const svg = generateBadgeSvg(result);
    await writeFile(badgePath, svg, "utf-8");
    badgeGenerated = true;
    if (!args.quiet) {
      process.stderr.write(`Badge written to ${badgePath}\n`);
      process.stderr.write(generateBadgeSnippets(args.badge));
    }
  }

  // Fire-and-forget telemetry (only if consent is active)
  const telemetryPayload = buildTelemetryPayload(result, result.metadata.duration, {
    format,
    badgeGenerated,
  });
  sendTelemetry(telemetryPayload);

  outputScanResult(result, format, args.verbose, args.quiet);

  const threshold = config.threshold ?? cliThreshold;
  if (threshold > 0 && result.score < threshold) {
    process.exit(1);
  }
}

/** Write scan result to stdout in the requested format. */
function outputScanResult(
  result: ScanResult,
  format: string,
  verbose: boolean,
  quiet: boolean,
): void {
  if (format === "json") {
    process.stdout.write(formatJson(result));
  } else if (format === "ndjson") {
    process.stdout.write(formatNdjson(result));
  } else if (format === "sarif") {
    process.stdout.write(formatSarif(result));
  } else if (format === "markdown") {
    process.stdout.write(formatMarkdown(result));
  } else {
    process.stdout.write(formatTerminal(result, { verbose, quiet }));
  }
}

/** Classify a fix proposal for dry-run display. */
function classifyFix(p: FixProposal): "AUTO-APPLY" | "SUGGEST" | "MANUAL" | "SKIPPED" {
  if (p.alreadyExists) return "SKIPPED";
  switch (p.confidence) {
    case "high":
      return "AUTO-APPLY";
    case "medium":
      return "SUGGEST";
    case "low":
      return "MANUAL";
    default:
      return "SUGGEST";
  }
}

/** Format dry-run output showing what would be created with confidence classification. */
function formatDryRun(
  actionable: FixProposal[],
  skipped: FixProposal[],
  overwrites: FixProposal[] = [],
): string {
  const lines: string[] = [];
  lines.push("\n--- Dry Run: Proposed Changes ---\n");

  // Group actionable by classification
  const autoApply = actionable.filter((p) => classifyFix(p) === "AUTO-APPLY");
  const suggest = actionable.filter((p) => classifyFix(p) === "SUGGEST");
  const manual = actionable.filter((p) => classifyFix(p) === "MANUAL");

  if (autoApply.length > 0) {
    lines.push("[AUTO-APPLY · high confidence]");
    for (const p of autoApply) {
      lines.push(`  CREATE  ${p.path}`);
      lines.push(`  |-- ${p.criterion}: ${truncateRationale(p.rationale)}`);
    }
    lines.push("");
  }

  if (suggest.length > 0) {
    lines.push("[SUGGEST · medium confidence]");
    for (const p of suggest) {
      lines.push(`  CREATE  ${p.path}`);
      lines.push(`  |-- ${p.criterion}: ${truncateRationale(p.rationale)}`);
    }
    lines.push("");
  }

  if (manual.length > 0) {
    lines.push("[MANUAL · low confidence]");
    for (const p of manual) {
      lines.push(`  CREATE  ${p.path}`);
      lines.push(`  |-- ${p.criterion}: ${truncateRationale(p.rationale)}`);
    }
    lines.push("");
  }

  if (overwrites.length > 0) {
    lines.push("[OVERWRITE · --force]");
    for (const p of overwrites) {
      lines.push(`  OVERWRITE  ${p.path}`);
      lines.push(`  |-- ${p.criterion}: ${truncateRationale(p.rationale)}`);
    }
    lines.push("");
  }

  if (skipped.length > 0) {
    lines.push("[SKIPPED -- already exists]");
    for (const p of skipped) {
      lines.push(`  SKIP    ${p.path}`);
    }
    lines.push("");
  }

  const totalNew = autoApply.length + suggest.length + manual.length;
  lines.push(
    `Total: ${totalNew} create, ${overwrites.length} overwrite, ${skipped.length} skipped\n`,
  );
  lines.push("Run without --dry-run to apply changes.\n");
  return lines.join("\n");
}

/** Truncate rationale to first sentence for dry-run display. */
function truncateRationale(rationale: string): string {
  const firstSentence = rationale.split(". ")[0];
  if (!firstSentence) return rationale;
  return firstSentence.endsWith(".") ? firstSentence : firstSentence + ".";
}

/** Apply fix proposals by writing files to disk. */
async function applyProposals(
  repoPath: string,
  actionable: FixProposal[],
  skipped: FixProposal[],
  quiet: boolean,
  overwrites: FixProposal[] = [],
): Promise<void> {
  const { mkdir } = await import("node:fs/promises");
  const { dirname, join } = await import("node:path");

  for (const p of actionable) {
    const fullPath = join(repoPath, p.path);
    const dir = dirname(fullPath);
    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, p.content, "utf-8");
    if (!quiet) {
      process.stderr.write(`  CREATE  ${p.path}  (${p.criterion})\n`);
    }
  }

  for (const p of overwrites) {
    const fullPath = join(repoPath, p.path);
    const dir = dirname(fullPath);
    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, p.content, "utf-8");
    if (!quiet) {
      process.stderr.write(`  OVERWRITE  ${p.path}  (${p.criterion}, --force)\n`);
    }
  }

  for (const p of skipped) {
    if (!quiet) {
      process.stderr.write(`  SKIP    ${p.path}  (already exists)\n`);
    }
  }

  const totalWritten = actionable.length + overwrites.length;
  if (!quiet) {
    const parts: string[] = [];
    if (actionable.length > 0) parts.push(`${actionable.length} created`);
    if (overwrites.length > 0) parts.push(`${overwrites.length} overwritten`);
    process.stderr.write(
      `\n${totalWritten} file(s) written (${parts.join(", ")}). Review and customize the generated files.\n`,
    );
  }
}

runMain(main);

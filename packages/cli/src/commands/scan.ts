/** Scan subcommand — runs all 8 pillar analyzers against a target directory. */
import { defineCommand } from "citty";
import { resolve } from "node:path";
import { access } from "node:fs/promises";
import { scan } from "@prontiq/ariscan-engine";
import type { OnProgress } from "@prontiq/ariscan-engine";
import type { ScanConfig, ScanResult } from "@prontiq/ariscan-schema";
import { PILLAR_NAMES, Archetype as ArchetypeSchema } from "@prontiq/ariscan-schema";
import { formatTerminal } from "../output/terminal.js";
import { formatJson, formatNdjson, formatJsonSchema } from "../output/json.js";
import { formatMarkdown } from "../output/markdown.js";
import { formatSarif } from "../output/sarif.js";
import { resolveFullConfig } from "../config-loader.js";
import { applyEnforcement } from "../enforcement.js";

export interface ScanOptions {
  path: string;
  format: string;
  verbose: boolean;
  quiet: boolean;
  json: boolean;
  jsonSchema: boolean;
  threshold: number;
  config?: string;
  archetype?: string;
}

async function validateRepoPath(path: string): Promise<string> {
  const repoPath = resolve(path);
  try {
    await access(repoPath);
  } catch {
    process.stderr.write(`Error: Path does not exist: ${repoPath}\n`);
    process.exit(2);
  }
  return repoPath;
}

function buildCliOverrides(options: ScanOptions): Partial<ScanConfig> {
  const overrides: Partial<ScanConfig> = {};
  if (options.threshold > 0) {
    overrides.threshold = options.threshold;
  }
  if (options.json) {
    overrides.format = "json";
  } else if (options.format !== "terminal") {
    overrides.format = options.format as ScanConfig["format"];
  }
  if (options.archetype) {
    const parsed = ArchetypeSchema.safeParse(options.archetype);
    if (parsed.success) {
      overrides.archetype = parsed.data;
    } else {
      process.stderr.write(
        `Warning: Invalid archetype "${options.archetype}". Valid values: ${ArchetypeSchema.options.join(", ")}\n`,
      );
    }
  }
  return overrides;
}

function formatOutput(result: ScanResult, format: string, options: ScanOptions): string {
  if (format === "json") return formatJson(result);
  if (format === "ndjson") return formatNdjson(result);
  if (format === "sarif") return formatSarif(result);
  if (format === "markdown") return formatMarkdown(result);
  return formatTerminal(result, { verbose: options.verbose, quiet: options.quiet });
}

function createProgressCallback(format: string, quiet: boolean): OnProgress | undefined {
  if (quiet || format !== "terminal") return undefined;
  return (event) => {
    const name = PILLAR_NAMES[event.pillar] ?? event.pillar;
    if (event.status === "done") {
      process.stderr.write(`  ✓ ${event.pillar} ${name} (${event.elapsed}ms)\n`);
    }
  };
}

export async function runScan(options: ScanOptions): Promise<void> {
  if (options.jsonSchema) {
    process.stdout.write(formatJsonSchema());
    return;
  }

  const repoPath = await validateRepoPath(options.path);
  const cliOverrides = buildCliOverrides(options);

  const { scanConfig, policyMeta } = await resolveFullConfig({
    repoPath,
    configPath: options.config,
    cliOverrides,
  });

  const format = options.json ? "json" : (scanConfig.format ?? options.format);

  if (!options.quiet && format === "terminal") {
    process.stderr.write(`\nScanning ${repoPath}...\n\n`);
  }

  let result: ScanResult;
  try {
    result = await scan(repoPath, scanConfig, createProgressCallback(format, options.quiet));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: Scan failed: ${message}\n`);
    process.exit(2);
  }

  process.stdout.write(formatOutput(result, format, options));

  applyEnforcement(result, scanConfig.threshold ?? options.threshold, policyMeta);
}

export const scanCommand = defineCommand({
  meta: {
    name: "scan",
    description: "Scan a repository and produce an ARI score",
  },
  args: {
    path: {
      type: "positional",
      description: "Path to the repository to scan",
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
    archetype: {
      type: "string",
      description:
        "Manual archetype override: solo-hobby, small-team, library, api-service, cli-tool, monorepo-enterprise",
      required: false,
    },
  },
  async run({ args }) {
    await runScan({
      path: args.path,
      format: args.format,
      verbose: args.verbose,
      quiet: args.quiet,
      json: args.json,
      jsonSchema: args.jsonSchema,
      threshold: parseInt(args.threshold, 10),
      config: args.config,
      archetype: args.archetype,
    });
  },
});

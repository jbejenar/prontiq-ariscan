import { defineCommand } from "citty";
import { resolve } from "node:path";
import { access } from "node:fs/promises";
import { scan } from "@prontiq/ariscan-engine";
import type { ScanConfig, ScanResult } from "@prontiq/ariscan-schema";
import { formatTerminal } from "../output/terminal.js";
import { formatJson, formatJsonSchema } from "../output/json.js";
import { formatMarkdown } from "../output/markdown.js";
import { formatSarif } from "../output/sarif.js";
import { resolveConfig } from "../config-loader.js";

export interface ScanOptions {
  path: string;
  format: string;
  verbose: boolean;
  quiet: boolean;
  json: boolean;
  jsonSchema: boolean;
  threshold: number;
  config?: string;
}

export async function runScan(options: ScanOptions): Promise<void> {
  if (options.jsonSchema) {
    process.stdout.write(formatJsonSchema());
    return;
  }

  const repoPath = resolve(options.path);

  // Validate path exists
  try {
    await access(repoPath);
  } catch {
    process.stderr.write(`Error: Path does not exist: ${repoPath}\n`);
    process.exit(2);
  }

  // Build CLI overrides
  const cliOverrides: Partial<ScanConfig> = {};
  if (options.threshold > 0) {
    cliOverrides.threshold = options.threshold;
  }
  if (options.json) {
    cliOverrides.format = "json";
  } else if (options.format !== "terminal") {
    cliOverrides.format = options.format as ScanConfig["format"];
  }

  // Resolve config: CLI flags > .ariscan.yml > defaults
  const scanConfig = await resolveConfig({
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
    result = await scan(repoPath, scanConfig);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: Scan failed: ${message}\n`);
    process.exit(2);
  }

  // Output result
  if (format === "json") {
    process.stdout.write(formatJson(result));
  } else if (format === "sarif") {
    process.stdout.write(formatSarif(result));
  } else if (format === "markdown") {
    process.stdout.write(formatMarkdown(result));
  } else {
    process.stdout.write(
      formatTerminal(result, { verbose: options.verbose, quiet: options.quiet }),
    );
  }

  // Exit code based on threshold
  const threshold = scanConfig.threshold ?? options.threshold;
  if (threshold > 0 && result.score < threshold) {
    process.exit(1);
  }
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
      description: "Output format: terminal, json, sarif, markdown",
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
    });
  },
});

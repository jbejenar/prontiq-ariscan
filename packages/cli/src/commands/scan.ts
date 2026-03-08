import { defineCommand } from "citty";
import { resolve } from "node:path";
import { access } from "node:fs/promises";
import { scan } from "@prontiq/engine";
import type { ScanResult } from "@prontiq/schema";
import { formatTerminal } from "../output/terminal.js";
import { formatJson } from "../output/json.js";

export interface ScanOptions {
  path: string;
  format: string;
  verbose: boolean;
  quiet: boolean;
  json: boolean;
  threshold: number;
}

export async function runScan(options: ScanOptions): Promise<void> {
  const repoPath = resolve(options.path);

  // Validate path exists
  try {
    await access(repoPath);
  } catch {
    process.stderr.write(`Error: Path does not exist: ${repoPath}\n`);
    process.exit(2);
  }

  const format = options.json ? "json" : options.format;

  if (!options.quiet && format === "terminal") {
    process.stderr.write(`\nScanning ${repoPath}...\n\n`);
  }

  let result: ScanResult;
  try {
    result = await scan(repoPath);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: Scan failed: ${message}\n`);
    process.exit(2);
  }

  // Output result
  if (format === "json") {
    process.stdout.write(formatJson(result));
  } else {
    process.stdout.write(formatTerminal(result, { verbose: options.verbose }));
  }

  // Exit code based on threshold
  if (options.threshold > 0 && result.score < options.threshold) {
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
  },
  async run({ args }) {
    await runScan({
      path: args.path,
      format: args.format,
      verbose: args.verbose,
      quiet: args.quiet,
      json: args.json,
      threshold: parseInt(args.threshold, 10),
    });
  },
});

import { defineCommand, runMain } from "citty";
import { resolve } from "node:path";
import { access } from "node:fs/promises";
import { scan } from "@prontiq/engine";
import { formatTerminal } from "./output/terminal.js";
import { formatJson } from "./output/json.js";
import type { ScanResult } from "@prontiq/schema";

const main = defineCommand({
  meta: {
    name: "ariscan",
    version: "0.1.0",
    description: "Measure and improve repository readiness for AI coding agents",
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
      description: "Output format: terminal, json",
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
    const repoPath = resolve(args.path);

    try {
      await access(repoPath);
    } catch {
      process.stderr.write(`Error: Path does not exist: ${repoPath}\n`);
      process.exit(2);
    }

    const format = args.json ? "json" : args.format;

    if (!args.quiet && format === "terminal") {
      process.stderr.write(`\nScanning ${repoPath}...\n`);
    }

    let result: ScanResult;
    try {
      result = await scan(repoPath);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Error: Scan failed: ${message}\n`);
      process.exit(2);
    }

    if (format === "json") {
      process.stdout.write(formatJson(result));
    } else {
      process.stdout.write(formatTerminal(result, { verbose: args.verbose }));
    }

    const threshold = parseInt(args.threshold, 10);
    if (threshold > 0 && result.score < threshold) {
      process.exit(1);
    }
  },
});

runMain(main);

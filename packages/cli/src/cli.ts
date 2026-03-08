import { defineCommand, runMain } from "citty";
import { resolve } from "node:path";
import { access } from "node:fs/promises";
import { scan } from "@prontiq/engine";
import { formatTerminal } from "./output/terminal.js";
import { formatJson, formatJsonSchema } from "./output/json.js";
import { formatMarkdown } from "./output/markdown.js";
import { resolveConfig } from "./config-loader.js";
import type { ScanResult } from "@prontiq/schema";

const main = defineCommand({
  meta: {
    name: "ariscan",
    version: "0.1.0",
    description: `Measure and improve repository readiness for AI coding agents

Examples:
  npx ariscan .                    # Scan current directory
  npx ariscan /path/to/repo --json # JSON output
  npx ariscan . --threshold 60     # Fail if score < 60`,
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
      description: "Output format: terminal, json, markdown",
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
    if (args.jsonSchema) {
      process.stdout.write(formatJsonSchema());
      return;
    }

    const repoPath = resolve(args.path);

    try {
      await access(repoPath);
    } catch {
      process.stderr.write(`Error: Path does not exist: ${repoPath}\n`);
      process.exit(2);
    }

    // Build CLI overrides (only include values explicitly set by user)
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

    // Resolve config: CLI flags > .ariscan.yml > defaults
    const config = await resolveConfig({
      repoPath,
      configPath: args.config,
      cliOverrides,
    });

    const format = args.json ? "json" : (config.format ?? args.format);

    if (!args.quiet && format === "terminal") {
      process.stderr.write(`\nScanning ${repoPath}...\n`);
    }

    let result: ScanResult;
    try {
      result = await scan(repoPath, config);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Error: Scan failed: ${message}\n`);
      process.exit(2);
    }

    if (format === "json") {
      process.stdout.write(formatJson(result));
    } else if (format === "markdown") {
      process.stdout.write(formatMarkdown(result));
    } else {
      process.stdout.write(formatTerminal(result, { verbose: args.verbose }));
    }

    const threshold = config.threshold ?? cliThreshold;
    if (threshold > 0 && result.score < threshold) {
      process.exit(1);
    }
  },
});

runMain(main);

/**
 * Simulate subcommand (P3.05) — Agent Simulation Hooks.
 *
 * Runs an agent-like workflow (clone → bootstrap → typecheck → test) and
 * compares the results with static analysis predictions.
 */
import { defineCommand } from "citty";
import { resolve } from "node:path";
import { access } from "node:fs/promises";
import {
  scan,
  detectCommands,
  buildStepConfigs,
  runSimulationSteps,
  NativeExecutor,
  DockerExecutor,
  resolveIsolationMode,
  compareStaticVsSimulation,
  predictionAccuracy,
} from "@prontiq/ariscan-engine";
import type { OnSimulationProgress } from "@prontiq/ariscan-engine";
import {
  DEFAULT_SIMULATION_PROFILE,
  IsolationMode as IsolationModeSchema,
  SimulationStepId,
} from "@prontiq/ariscan-schema";
import type { SimulationResult, SimulationProfile, IsolationMode } from "@prontiq/ariscan-schema";

export const simulateCommand = defineCommand({
  meta: {
    name: "simulate",
    description: `Simulate an AI agent workflow to validate repository readiness

Static analysis detects whether bootstrap scripts and devcontainers exist, but
cannot verify they actually work. Simulation bridges that gap by executing the
agent workflow end-to-end and comparing results with static predictions.

Research basis:
  - Tutorial Problem (VS Code Blog, 2022): 94-96% drop-off when users must
    follow manual setup steps — agents face the same barrier.
  - SWE-bench Setup Analysis (2025): agent task failure frequently traces to
    environment setup, not task complexity.
  - Microsoft/GitLab (2022): standardized environments reduce onboarding time
    by 60% and integration conflicts by 30%.
See docs/research/EVIDENCE-BASE.md entries 4.1-4.3 for full citations.

Examples:
  ariscan simulate .                    # Simulate with auto-detected isolation
  ariscan simulate . --isolation native # Run natively (no Docker)
  ariscan simulate . --json             # JSON output
  ariscan simulate . --timeout 300000   # 5 minute total timeout
  ariscan simulate . --steps bootstrap,test  # Only run specific steps`,
  },
  args: {
    path: {
      type: "positional",
      description: "Path to the repository to simulate",
      required: false,
      default: ".",
    },
    isolation: {
      type: "string",
      description: "Isolation mode: docker, devcontainer, native (auto-detected by default)",
      required: false,
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
    timeout: {
      type: "string",
      description: "Total timeout in milliseconds (default: 600000 = 10 minutes)",
      default: "600000",
    },
    stepTimeout: {
      type: "string",
      description: "Per-step timeout in milliseconds (default: 180000 = 3 minutes)",
      default: "180000",
    },
    steps: {
      type: "string",
      description: "Comma-separated list of steps to run: clone,bootstrap,typecheck,test",
      required: false,
    },
    compare: {
      type: "boolean",
      description: "Run static scan and compare predictions with simulation (default: true)",
      default: true,
    },
  },
  async run({ args }) {
    await runSimulate({
      path: args.path as string,
      isolation: args.isolation as string | undefined,
      json: args.json as boolean,
      quiet: args.quiet as boolean,
      timeout: parseInt(args.timeout as string, 10),
      stepTimeout: parseInt(args.stepTimeout as string, 10),
      steps: args.steps as string | undefined,
      compare: args.compare as boolean,
    });
  },
});

interface SimulateOptions {
  path: string;
  isolation?: string;
  json: boolean;
  quiet: boolean;
  timeout: number;
  stepTimeout: number;
  steps?: string;
  compare: boolean;
}

export async function runSimulate(options: SimulateOptions): Promise<void> {
  const repoPath = resolve(options.path);
  try {
    await access(repoPath);
  } catch {
    process.stderr.write(`Error: Path does not exist: ${repoPath}\n`);
    process.exit(2);
  }

  // Parse isolation mode
  let isolationOverride: IsolationMode | undefined;
  if (options.isolation) {
    const parsed = IsolationModeSchema.safeParse(options.isolation);
    if (!parsed.success) {
      process.stderr.write(
        `Error: Invalid isolation mode '${options.isolation}'. ` +
          "Use: docker, devcontainer, or native\n",
      );
      process.exit(2);
    }
    isolationOverride = parsed.data;
  }

  // Parse steps
  const profile: SimulationProfile = {
    ...DEFAULT_SIMULATION_PROFILE,
    totalTimeoutMs: options.timeout,
    stepTimeoutMs: options.stepTimeout,
  };
  if (options.steps) {
    const requestedSteps = options.steps.split(",").map((s) => s.trim());
    const validSteps: SimulationProfile["steps"] = [];
    for (const s of requestedSteps) {
      const parsed = SimulationStepId.safeParse(s);
      if (!parsed.success) {
        process.stderr.write(
          `Error: Invalid step '${s}'. Use: clone, bootstrap, typecheck, test\n`,
        );
        process.exit(2);
      }
      validSteps.push(parsed.data);
    }
    profile.steps = validSteps;
  }

  if (!options.quiet && !options.json) {
    process.stderr.write(`\nSimulating agent workflow for ${repoPath}...\n`);
  }

  // Resolve isolation mode
  let isolation: Awaited<ReturnType<typeof resolveIsolationMode>>;
  try {
    isolation = await resolveIsolationMode(repoPath, isolationOverride);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: ${message}\n`);
    process.exit(2);
  }

  if (!options.quiet && !options.json) {
    process.stderr.write(`  Isolation: ${isolation.mode}`);
    if (isolation.dockerImage) {
      process.stderr.write(` (${isolation.dockerImage})`);
    }
    process.stderr.write("\n");
  }

  // Detect commands
  const commands = await detectCommands(repoPath);
  if (!options.quiet && !options.json) {
    process.stderr.write(`  Bootstrap: ${commands.bootstrap ?? "(not detected)"}\n`);
    process.stderr.write(`  Typecheck: ${commands.typecheck ?? "(not detected)"}\n`);
    process.stderr.write(`  Test:      ${commands.test ?? "(not detected)"}\n\n`);
  }

  // Build step configs
  const stepConfigs = buildStepConfigs(commands, repoPath, profile);

  // Create executor
  const containerName = `ariscan-sim-${Date.now()}`;
  let executor: NativeExecutor | DockerExecutor;
  if (isolation.mode === "native") {
    executor = new NativeExecutor();
  } else {
    executor = new DockerExecutor(isolation.dockerImage ?? "node:22-slim", containerName);
    try {
      if (!options.quiet && !options.json) {
        process.stderr.write("  Starting Docker container...\n");
      }
      await (executor as DockerExecutor).start(repoPath, "/workspace");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Error: Failed to start Docker container: ${message}\n`);
      process.exit(2);
    }
  }

  // Progress callback
  const onProgress: OnSimulationProgress | undefined =
    !options.quiet && !options.json
      ? (event) => {
          if (event.status === "starting") {
            process.stderr.write(`  ⏳ ${event.step}: ${event.command}\n`);
          } else if (event.status === "pass") {
            process.stderr.write(`  ✓ ${event.step}: passed (${event.durationMs}ms)\n`);
          } else if (event.status === "fail") {
            process.stderr.write(`  ✗ ${event.step}: failed (${event.durationMs}ms)\n`);
          } else if (event.status === "timeout") {
            process.stderr.write(`  ⏰ ${event.step}: timed out (${event.durationMs}ms)\n`);
          } else if (event.status === "skip") {
            process.stderr.write(`  ⊘ ${event.step}: skipped\n`);
          }
        }
      : undefined;

  // Run simulation
  const startedAt = new Date().toISOString();
  const simStart = performance.now();
  let stepResults;
  try {
    stepResults = await runSimulationSteps(executor, stepConfigs, profile, onProgress);
  } finally {
    // Cleanup Docker container if used
    if (isolation.mode !== "native") {
      try {
        await (executor as DockerExecutor).cleanup();
      } catch {
        // Best-effort cleanup
      }
    }
  }

  const timeToGreenMs = Math.round(performance.now() - simStart);
  const allPassed = stepResults.every((s) => s.status === "pass" || s.status === "skip");

  // Optional static scan comparison
  let comparisons: SimulationResult["comparison"] = [];
  let staticScore: number | null = null;

  if (options.compare) {
    if (!options.quiet && !options.json) {
      process.stderr.write("\n  Running static scan for comparison...\n");
    }
    try {
      const scanResult = await scan(repoPath);
      staticScore = scanResult.score;
      comparisons = compareStaticVsSimulation(scanResult, stepResults);
    } catch {
      if (!options.quiet && !options.json) {
        process.stderr.write("  Warning: Static scan failed, skipping comparison\n");
      }
    }
  }

  // Get node version
  let nodeVersion: string | null = null;
  if (isolation.mode === "native") {
    nodeVersion = process.version;
  }

  // Build result
  const result: SimulationResult = {
    version: "1.0.0",
    repoPath,
    isolation: isolation.mode,
    timeToGreenMs,
    allPassed,
    steps: stepResults,
    comparison: comparisons,
    staticScore,
    metadata: {
      startedAt,
      timeoutMs: profile.totalTimeoutMs,
      dockerImage: isolation.dockerImage,
      devcontainerDetected: isolation.devcontainerDetected,
      nodeVersion,
    },
  };

  // Output
  if (options.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else {
    process.stdout.write(formatSimulationTerminal(result));
  }

  // Exit code: 0 if all passed, 1 if any failed
  if (!allPassed) {
    process.exit(1);
  }
}

/** Format simulation result for terminal output. */
function formatSimulationTerminal(result: SimulationResult): string {
  const lines: string[] = [];

  lines.push("");
  lines.push("═══════════════════════════════════════════════════");
  lines.push("  Agent Simulation Report");
  lines.push("═══════════════════════════════════════════════════");
  lines.push("");

  // Summary
  const status = result.allPassed ? "✓ ALL PASSED" : "✗ FAILED";
  lines.push(`  Status:       ${status}`);
  lines.push(`  Time-to-green: ${formatDuration(result.timeToGreenMs)}`);
  lines.push(
    `  Isolation:    ${result.isolation}${result.metadata.dockerImage ? ` (${result.metadata.dockerImage})` : ""}`,
  );
  lines.push("");

  // Steps
  lines.push("  Steps:");
  lines.push("  ─────────────────────────────────────────────────");
  for (const step of result.steps) {
    const icon = stepIcon(step.status);
    const duration = step.status === "skip" ? "" : ` (${formatDuration(step.durationMs)})`;
    lines.push(`  ${icon} ${step.step.padEnd(12)} ${step.status}${duration}`);
    if (step.status === "fail" && step.stderr) {
      const firstLine = step.stderr.split("\n").filter(Boolean)[0] ?? "";
      if (firstLine) {
        lines.push(`    └─ ${firstLine.slice(0, 80)}`);
      }
    }
  }
  lines.push("");

  // Comparison
  if (result.comparison.length > 0) {
    lines.push("  Static vs Simulation Comparison:");
    lines.push("  ─────────────────────────────────────────────────");

    for (const c of result.comparison) {
      const icon = c.accurate ? "✓" : "✗";
      lines.push(`  ${icon} [${c.pillar}] ${c.prediction}`);
      lines.push(`    → ${c.reality}`);
    }

    const accuracy = predictionAccuracy(result.comparison);
    lines.push("");
    lines.push(
      `  Prediction accuracy: ${accuracy}% (${result.comparison.filter((c) => c.accurate).length}/${result.comparison.length})`,
    );

    if (result.staticScore !== null) {
      lines.push(`  Static scan score:   ${result.staticScore}`);
    }
  }

  lines.push("");
  lines.push("═══════════════════════════════════════════════════");
  lines.push("");

  return lines.join("\n");
}

function stepIcon(status: string): string {
  switch (status) {
    case "pass":
      return "✓";
    case "fail":
      return "✗";
    case "timeout":
      return "⏰";
    case "skip":
      return "⊘";
    default:
      return "?";
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

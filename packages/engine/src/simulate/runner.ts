/**
 * Simulation step runner (P3.05).
 *
 * Orchestrates the execution of simulation steps in sequence,
 * with timeout handling and progress reporting.
 */
import { spawn } from "node:child_process";
import type {
  SimulationStepResult,
  SimulationStepStatus,
  SimulationProfile,
} from "@prontiq/ariscan-schema";
import { DEFAULT_SIMULATION_PROFILE } from "@prontiq/ariscan-schema";
import type { StepConfig, StepExecutor, OnSimulationProgress, DetectedCommands } from "./types.js";

/** Maximum characters to capture from stdout/stderr. */
const OUTPUT_LIMIT = 2000;

/** Truncate output to the last N characters. */
function truncateOutput(output: string): string {
  if (output.length <= OUTPUT_LIMIT) return output;
  return "...(truncated)\n" + output.slice(-OUTPUT_LIMIT);
}

/**
 * Native step executor — runs commands directly on the host.
 */
export class NativeExecutor implements StepExecutor {
  async execute(config: StepConfig): Promise<SimulationStepResult> {
    const start = performance.now();
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), config.timeoutMs);

    try {
      const result = await spawnCommand(config.command, config.cwd, ac.signal);
      clearTimeout(timer);
      const durationMs = Math.round(performance.now() - start);

      const status: SimulationStepStatus = result.exitCode === 0 ? "pass" : "fail";

      return {
        step: config.id,
        status,
        durationMs,
        command: config.command,
        exitCode: result.exitCode,
        stdout: truncateOutput(result.stdout),
        stderr: truncateOutput(result.stderr),
      };
    } catch (error: unknown) {
      clearTimeout(timer);
      const durationMs = Math.round(performance.now() - start);

      if (isAbortError(error)) {
        return {
          step: config.id,
          status: "timeout",
          durationMs,
          command: config.command,
          exitCode: null,
          stdout: "",
          stderr: `Step timed out after ${config.timeoutMs}ms`,
        };
      }

      return {
        step: config.id,
        status: "fail",
        durationMs,
        command: config.command,
        exitCode: null,
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * Docker step executor — runs commands inside a Docker container.
 */
export class DockerExecutor implements StepExecutor {
  constructor(
    private readonly image: string,
    private readonly containerName: string,
  ) {}

  async execute(config: StepConfig): Promise<SimulationStepResult> {
    // Wrap the command to run inside Docker — escape all interpolated values
    const dockerCmd = `docker exec -w ${shellEscape(config.cwd)} ${shellEscape(this.containerName)} sh -c ${shellEscape(config.command)}`;
    const nativeConfig: StepConfig = {
      ...config,
      command: dockerCmd,
      cwd: process.cwd(), // Docker exec runs from host
    };
    const native = new NativeExecutor();
    return native.execute(nativeConfig);
  }

  /** Start the Docker container for simulation. */
  async start(repoPath: string, workDir: string): Promise<void> {
    const start = performance.now();

    const result = await spawnArgs(
      "docker",
      [
        "run",
        "-d",
        "--name",
        this.containerName,
        "-v",
        `${repoPath}:${workDir}`,
        "-w",
        workDir,
        this.image,
        "sleep",
        "infinity",
      ],
      process.cwd(),
      AbortSignal.timeout(120_000),
    );

    const durationMs = Math.round(performance.now() - start);
    if (result.exitCode !== 0) {
      throw new Error(
        `Failed to start Docker container (${durationMs}ms): ${result.stderr || result.stdout}`,
      );
    }
  }

  /** Stop and remove the Docker container. */
  async cleanup(): Promise<void> {
    await spawnArgs(
      "docker",
      ["rm", "-f", this.containerName],
      process.cwd(),
      AbortSignal.timeout(30_000),
    );
  }
}

/** Escape a string for safe use in sh -c. */
function shellEscape(cmd: string): string {
  return `'${cmd.replace(/'/g, "'\\''")}'`;
}

/** Check if an error is an abort error. */
function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || (error as NodeJS.ErrnoException).code === "ABORT_ERR")
  );
}

/**
 * Spawn a shell command and collect output.
 * Note: `cwd` is passed as a Node.js spawn option (handled at OS level),
 * not interpolated into the shell command string — safe from injection.
 */
function spawnCommand(
  command: string,
  cwd: string,
  signal: AbortSignal,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("sh", ["-c", command], {
      cwd,
      signal,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      reject(err);
    });

    child.on("close", (code) => {
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
  });
}

/**
 * Spawn a command with an explicit argument array (no shell interpretation).
 * Used for Docker commands where arguments may contain special characters.
 */
function spawnArgs(
  command: string,
  args: string[],
  cwd: string,
  signal: AbortSignal,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      signal,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      reject(err);
    });

    child.on("close", (code) => {
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
  });
}

/**
 * Detect which commands to run for each simulation step
 * by inspecting the repo's package.json scripts.
 */
export async function detectCommands(repoPath: string): Promise<DetectedCommands> {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");

  let scripts: Record<string, string> = {};
  try {
    const raw = await readFile(join(repoPath, "package.json"), "utf-8");
    const pkg = JSON.parse(raw) as { scripts?: Record<string, string> };
    scripts = pkg.scripts ?? {};
  } catch {
    // No package.json or not parseable — try other ecosystems
  }

  // Detect package manager once, use consistently across all steps
  const { access: fsAccess } = await import("node:fs/promises");
  const pm = await detectPackageManager(repoPath, fsAccess, join);

  // Try package.json scripts first
  const bootstrap = detectBootstrapCommand(scripts, pm);
  const typecheck = detectTypecheckCommand(scripts, pm);
  const test = detectTestCommand(scripts, pm);

  return { bootstrap, typecheck, test };
}

function detectBootstrapCommand(scripts: Record<string, string>, pm: string): string | null {
  const install = `${pm} install`;
  const hasBuild = Boolean(scripts["prepare"] || scripts["build"]);

  if (hasBuild) {
    return `${install} && ${pm} run build`;
  }

  // If package.json has any scripts, at least run install
  if (Object.keys(scripts).length > 0 || scripts["install"] || scripts["postinstall"]) {
    return install;
  }

  return null;
}

/** Detect the package manager by checking for lockfiles. */
async function detectPackageManager(
  repoPath: string,
  fsAccess: typeof import("node:fs/promises").access,
  join: typeof import("node:path").join,
): Promise<string> {
  const lockfiles: Array<[string, string]> = [
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["bun.lockb", "bun"],
    ["bun.lock", "bun"],
    ["package-lock.json", "npm"],
  ];

  for (const [file, pm] of lockfiles) {
    try {
      await fsAccess(join(repoPath, file));
      return pm;
    } catch {
      continue;
    }
  }

  return "npm";
}

function detectTypecheckCommand(scripts: Record<string, string>, pm: string): string | null {
  if (scripts["typecheck"]) return `${pm} run typecheck`;
  if (scripts["type-check"]) return `${pm} run type-check`;
  if (scripts["tsc"]) return `${pm} run tsc`;
  return null;
}

function detectTestCommand(scripts: Record<string, string>, pm: string): string | null {
  if (scripts["test"]) return `${pm} test`;
  return null;
}

/**
 * Build step configs for a simulation run.
 */
export function buildStepConfigs(
  commands: DetectedCommands,
  workDir: string,
  profile: SimulationProfile = DEFAULT_SIMULATION_PROFILE,
): StepConfig[] {
  const configs: StepConfig[] = [];

  for (const stepId of profile.steps) {
    if (stepId === "clone") {
      // Clone is handled separately — it's the initial setup
      configs.push({
        id: "clone",
        command: "true", // No-op for native; Docker handles via volume mount
        cwd: workDir,
        timeoutMs: profile.stepTimeoutMs,
      });
      continue;
    }

    const command = commands[stepId];
    if (!command) {
      // Step not available — will be skipped
      configs.push({
        id: stepId,
        command: "",
        cwd: workDir,
        timeoutMs: profile.stepTimeoutMs,
      });
      continue;
    }

    configs.push({
      id: stepId,
      command,
      cwd: workDir,
      timeoutMs: profile.stepTimeoutMs,
    });
  }

  return configs;
}

/**
 * Run all simulation steps sequentially with progress reporting.
 */
export async function runSimulationSteps(
  executor: StepExecutor,
  steps: StepConfig[],
  profile: SimulationProfile = DEFAULT_SIMULATION_PROFILE,
  onProgress?: OnSimulationProgress,
): Promise<SimulationStepResult[]> {
  const results: SimulationStepResult[] = [];
  const totalStart = performance.now();

  for (const step of steps) {
    // Check total timeout
    const elapsed = performance.now() - totalStart;
    if (elapsed >= profile.totalTimeoutMs) {
      results.push({
        step: step.id,
        status: "timeout",
        durationMs: 0,
        command: step.command,
        exitCode: null,
        stdout: "",
        stderr: `Total simulation timeout (${profile.totalTimeoutMs}ms) exceeded`,
      });
      continue;
    }

    // Skip steps with no command
    if (!step.command) {
      onProgress?.({ step: step.id, status: "skip" });
      results.push({
        step: step.id,
        status: "skip",
        durationMs: 0,
        command: "(not detected)",
        exitCode: null,
        stdout: "",
        stderr: "No command detected for this step",
      });
      continue;
    }

    onProgress?.({ step: step.id, status: "starting", command: step.command });

    // Adjust step timeout to not exceed remaining total timeout
    const remaining = profile.totalTimeoutMs - (performance.now() - totalStart);
    const effectiveTimeout = Math.min(step.timeoutMs, remaining);
    const adjustedStep = { ...step, timeoutMs: effectiveTimeout };

    const result = await executor.execute(adjustedStep);
    results.push(result);

    onProgress?.({
      step: step.id,
      status: result.status,
      durationMs: result.durationMs,
    });

    // Stop on failure or timeout — no point continuing
    if (result.status === "fail" || result.status === "timeout") {
      // Mark remaining steps as skipped
      const currentIdx = steps.indexOf(step);
      for (let i = currentIdx + 1; i < steps.length; i++) {
        const remaining_step = steps[i];
        if (remaining_step) {
          results.push({
            step: remaining_step.id,
            status: "skip",
            durationMs: 0,
            command: remaining_step.command || "(not detected)",
            exitCode: null,
            stdout: "",
            stderr: `Skipped: previous step '${step.id}' ${result.status === "timeout" ? "timed out" : "failed"}`,
          });
        }
      }
      break;
    }
  }

  return results;
}

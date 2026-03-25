/**
 * Simulation types (P3.05).
 *
 * Defines the schema for `ariscan simulate` output — per-step timing,
 * pass/fail status, error logs, and comparison with static analysis.
 */
import { z } from "zod";

/** Steps in the agent simulation workflow. */
export const SimulationStepId = z.enum(["clone", "bootstrap", "typecheck", "test"]);
export type SimulationStepId = z.infer<typeof SimulationStepId>;

/** Status of a single simulation step. */
export const SimulationStepStatus = z.enum(["pass", "fail", "skip", "timeout"]);
export type SimulationStepStatus = z.infer<typeof SimulationStepStatus>;

/** Result of a single simulation step. */
export const SimulationStepResult = z.object({
  /** Which step this result is for. */
  step: SimulationStepId,
  /** Whether the step passed, failed, was skipped, or timed out. */
  status: SimulationStepStatus,
  /** Duration in milliseconds. */
  durationMs: z.number(),
  /** Command that was executed. */
  command: z.string(),
  /** Exit code from the command (null if timed out or skipped). */
  exitCode: z.number().nullable(),
  /** Truncated stdout (last 2000 chars). */
  stdout: z.string(),
  /** Truncated stderr (last 2000 chars). */
  stderr: z.string(),
});
export type SimulationStepResult = z.infer<typeof SimulationStepResult>;

/** Comparison between static analysis prediction and simulation reality. */
export const PredictionComparison = z.object({
  /** What the static scan predicted (e.g. "bootstrap likely to succeed"). */
  prediction: z.string(),
  /** What actually happened during simulation. */
  reality: z.string(),
  /** Whether the prediction was correct. */
  accurate: z.boolean(),
  /** Which pillar this prediction relates to. */
  pillar: z.string(),
});
export type PredictionComparison = z.infer<typeof PredictionComparison>;

/** Isolation mode for the simulation environment. */
export const IsolationMode = z.enum(["docker", "devcontainer", "native"]);
export type IsolationMode = z.infer<typeof IsolationMode>;

/** Full result of an `ariscan simulate` run. */
export const SimulationResult = z.object({
  /** Version of the simulation result schema. */
  version: z.literal("1.0.0"),
  /** Repository path that was simulated. */
  repoPath: z.string(),
  /** Isolation mode used. */
  isolation: IsolationMode,
  /** Total time-to-green in milliseconds (clone to all-pass, or clone to first-failure). */
  timeToGreenMs: z.number(),
  /** Whether all steps passed (time-to-green is meaningful). */
  allPassed: z.boolean(),
  /** Per-step results in execution order. */
  steps: z.array(SimulationStepResult),
  /** Comparison of static analysis predictions vs simulation reality. */
  comparison: z.array(PredictionComparison),
  /** Static scan composite score (if comparison was run). */
  staticScore: z.number().nullable(),
  /** Simulation metadata. */
  metadata: z.object({
    /** When the simulation started (ISO 8601). */
    startedAt: z.string(),
    /** Total timeout configured in milliseconds. */
    timeoutMs: z.number(),
    /** Docker image used (null if native). */
    dockerImage: z.string().nullable(),
    /** Whether devcontainer.json was detected. */
    devcontainerDetected: z.boolean(),
    /** Node.js version in the simulation environment. */
    nodeVersion: z.string().nullable(),
  }),
});
export type SimulationResult = z.infer<typeof SimulationResult>;

/** Configuration for which steps to run and their timeouts. */
export const SimulationProfile = z.object({
  /** Which steps to include. */
  steps: z.array(SimulationStepId),
  /** Per-step timeout in milliseconds. */
  stepTimeoutMs: z.number().default(180_000),
  /** Total simulation timeout in milliseconds. */
  totalTimeoutMs: z.number().default(600_000),
});
export type SimulationProfile = z.infer<typeof SimulationProfile>;

/** Default simulation profile — all steps, 3min per step, 10min total. */
export const DEFAULT_SIMULATION_PROFILE: SimulationProfile = {
  steps: ["clone", "bootstrap", "typecheck", "test"],
  stepTimeoutMs: 180_000,
  totalTimeoutMs: 600_000,
};

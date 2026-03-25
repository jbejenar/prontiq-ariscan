/**
 * Internal types for simulation step execution (P3.05).
 */
import type {
  SimulationStepId,
  SimulationStepResult,
  SimulationStepStatus,
} from "@prontiq/ariscan-schema";

/** Configuration for a single simulation step. */
export interface StepConfig {
  /** Step identifier. */
  id: SimulationStepId;
  /** Shell command to execute. */
  command: string;
  /** Working directory for the command. */
  cwd: string;
  /** Timeout for this step in milliseconds. */
  timeoutMs: number;
}

/** Interface for executing commands in an isolation environment. */
export interface StepExecutor {
  /**
   * Execute a command and return the result.
   * Implementations handle Docker, devcontainer, or native execution.
   */
  execute(config: StepConfig): Promise<SimulationStepResult>;
}

/** Callback for simulation progress. */
export type OnSimulationProgress = (event: SimulationProgressEvent) => void;

/** Progress event during simulation. */
export interface SimulationProgressEvent {
  step: SimulationStepId;
  status: "starting" | SimulationStepStatus;
  durationMs?: number;
  command?: string;
}

/** Commands detected from a repository for each simulation step. */
export interface DetectedCommands {
  bootstrap: string | null;
  typecheck: string | null;
  test: string | null;
}

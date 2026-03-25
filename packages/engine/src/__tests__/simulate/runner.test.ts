import { describe, it, expect } from "vitest";
import type { SimulationStepResult, SimulationProfile } from "@prontiq/ariscan-schema";
import { DEFAULT_SIMULATION_PROFILE } from "@prontiq/ariscan-schema";
import { buildStepConfigs, runSimulationSteps } from "../../simulate/runner.js";
import type {
  StepConfig,
  StepExecutor,
  DetectedCommands,
  OnSimulationProgress,
} from "../../simulate/types.js";

/** Create a mock executor that resolves steps with configurable results. */
function createMockExecutor(results: Map<string, Partial<SimulationStepResult>>): StepExecutor {
  return {
    async execute(config: StepConfig): Promise<SimulationStepResult> {
      const override = results.get(config.id) ?? {};
      return {
        step: config.id,
        status: "pass",
        durationMs: 100,
        command: config.command,
        exitCode: 0,
        stdout: "",
        stderr: "",
        ...override,
      };
    },
  };
}

describe("buildStepConfigs", () => {
  it("builds configs for all detected commands", () => {
    const commands: DetectedCommands = {
      bootstrap: "npm install",
      typecheck: "npm run typecheck",
      test: "npm test",
    };

    const configs = buildStepConfigs(commands, "/repo");
    expect(configs).toHaveLength(4);
    expect(configs[0]?.id).toBe("clone");
    expect(configs[1]?.id).toBe("bootstrap");
    expect(configs[1]?.command).toBe("npm install");
    expect(configs[2]?.id).toBe("typecheck");
    expect(configs[3]?.id).toBe("test");
  });

  it("builds empty command for missing steps", () => {
    const commands: DetectedCommands = {
      bootstrap: "npm install",
      typecheck: null,
      test: "npm test",
    };

    const configs = buildStepConfigs(commands, "/repo");
    const typecheck = configs.find((c) => c.id === "typecheck");
    expect(typecheck?.command).toBe("");
  });

  it("respects custom profile steps", () => {
    const commands: DetectedCommands = {
      bootstrap: "npm install",
      typecheck: null,
      test: "npm test",
    };
    const profile: SimulationProfile = {
      steps: ["bootstrap", "test"],
      stepTimeoutMs: 60_000,
      totalTimeoutMs: 300_000,
    };

    const configs = buildStepConfigs(commands, "/repo", profile);
    expect(configs).toHaveLength(2);
    expect(configs[0]?.id).toBe("bootstrap");
    expect(configs[1]?.id).toBe("test");
  });

  it("uses profile timeout values", () => {
    const commands: DetectedCommands = {
      bootstrap: "npm install",
      typecheck: null,
      test: null,
    };
    const profile: SimulationProfile = {
      steps: ["bootstrap"],
      stepTimeoutMs: 60_000,
      totalTimeoutMs: 300_000,
    };

    const configs = buildStepConfigs(commands, "/repo", profile);
    expect(configs[0]?.timeoutMs).toBe(60_000);
  });
});

describe("runSimulationSteps", () => {
  it("runs all steps sequentially and returns results", async () => {
    const executor = createMockExecutor(new Map());
    const steps: StepConfig[] = [
      { id: "clone", command: "true", cwd: "/repo", timeoutMs: 60_000 },
      { id: "bootstrap", command: "npm install", cwd: "/repo", timeoutMs: 60_000 },
    ];

    const results = await runSimulationSteps(executor, steps);
    expect(results).toHaveLength(2);
    expect(results[0]?.status).toBe("pass");
    expect(results[1]?.status).toBe("pass");
  });

  it("skips steps with no command", async () => {
    const executor = createMockExecutor(new Map());
    const steps: StepConfig[] = [{ id: "typecheck", command: "", cwd: "/repo", timeoutMs: 60_000 }];

    const results = await runSimulationSteps(executor, steps);
    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe("skip");
  });

  it("stops on failure and skips remaining steps", async () => {
    const executor = createMockExecutor(new Map([["bootstrap", { status: "fail", exitCode: 1 }]]));
    const steps: StepConfig[] = [
      { id: "bootstrap", command: "npm install", cwd: "/repo", timeoutMs: 60_000 },
      { id: "typecheck", command: "npm run typecheck", cwd: "/repo", timeoutMs: 60_000 },
      { id: "test", command: "npm test", cwd: "/repo", timeoutMs: 60_000 },
    ];

    const results = await runSimulationSteps(executor, steps);
    expect(results).toHaveLength(3);
    expect(results[0]?.status).toBe("fail");
    expect(results[1]?.status).toBe("skip");
    expect(results[1]?.stderr).toContain("previous step");
    expect(results[2]?.status).toBe("skip");
  });

  it("stops on timeout and skips remaining steps", async () => {
    const executor = createMockExecutor(
      new Map([["bootstrap", { status: "timeout", exitCode: null }]]),
    );
    const steps: StepConfig[] = [
      { id: "bootstrap", command: "npm install", cwd: "/repo", timeoutMs: 60_000 },
      { id: "test", command: "npm test", cwd: "/repo", timeoutMs: 60_000 },
    ];

    const results = await runSimulationSteps(executor, steps);
    expect(results).toHaveLength(2);
    expect(results[0]?.status).toBe("timeout");
    expect(results[1]?.status).toBe("skip");
    expect(results[1]?.stderr).toContain("timed out");
  });

  it("reports progress events", async () => {
    const executor = createMockExecutor(new Map());
    const steps: StepConfig[] = [
      { id: "bootstrap", command: "npm install", cwd: "/repo", timeoutMs: 60_000 },
    ];

    const events: Array<{ step: string; status: string }> = [];
    const onProgress: OnSimulationProgress = (event) => {
      events.push({ step: event.step, status: event.status });
    };

    await runSimulationSteps(executor, steps, DEFAULT_SIMULATION_PROFILE, onProgress);
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ step: "bootstrap", status: "starting" });
    expect(events[1]).toEqual(expect.objectContaining({ step: "bootstrap", status: "pass" }));
  });
});

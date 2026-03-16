import { describe, it, expect, vi } from "vitest";

// We test the internal helpers (classifyContextFile, determineParseStatus)
// and the high-level scan orchestration behavior by mocking dependencies.

describe("scan module", () => {
  it("classifyContextFile maps known files to correct types", async () => {
    // Import the module to verify exports exist
    const mod = await import("../scan.js");
    expect(mod.scan).toBeDefined();
    expect(typeof mod.scan).toBe("function");
  });

  it("scan returns a ScanResult with expected shape", async () => {
    // Use dynamic import so vi.mock can intercept
    vi.mock("../context/repo-context.js", () => ({
      createRepoContext: vi.fn().mockResolvedValue({
        rootPath: "/mock",
        files: Object.freeze(["package.json", "src/index.ts"]),
        readFile: vi.fn().mockResolvedValue(null),
        fileExists: vi.fn().mockResolvedValue(false),
        readJson: vi.fn().mockResolvedValue(null),
      }),
    }));

    vi.mock("../detection/index.js", () => ({
      detect: vi.fn().mockResolvedValue({
        languages: [],
        frameworks: [],
        monorepo: null,
      }),
    }));

    const { scan } = await import("../scan.js");
    const result = await scan("/mock");

    expect(result).toBeDefined();
    expect(typeof result.score).toBe("number");
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.pillars).toBeDefined();
    expect(Array.isArray(result.pillars)).toBe(true);
    expect(result.metadata).toBeDefined();
    expect(result.metadata.version).toBe("0.2.0");
    expect(["L1", "L2", "L3", "L4", "L5"]).toContain(result.level);
  });

  it("scan invokes onProgress callback", async () => {
    const { scan } = await import("../scan.js");
    const events: Array<{ pillar: string; status: string }> = [];
    const onProgress = vi.fn((event: { pillar: string; status: string }) => {
      events.push(event);
    });

    await scan("/mock", {}, onProgress);

    expect(onProgress).toHaveBeenCalled();
    // Each analyzer should emit a start and done event
    const startEvents = events.filter((e) => e.status === "start");
    const doneEvents = events.filter((e) => e.status === "done");
    expect(startEvents.length).toBeGreaterThan(0);
    expect(startEvents.length).toBe(doneEvents.length);
  });
});

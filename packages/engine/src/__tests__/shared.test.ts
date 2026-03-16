import { describe, it, expect } from "vitest";
import {
  clampScore,
  buildPillarResult,
  anyFileExists,
  findFirstExisting,
} from "../analyzers/shared.js";
import { createMockContext } from "./helpers.js";

describe("clampScore", () => {
  it("clamps values above 100", () => {
    expect(clampScore(150)).toBe(100);
  });

  it("clamps values below 0", () => {
    expect(clampScore(-10)).toBe(0);
  });

  it("passes through values in range", () => {
    expect(clampScore(50)).toBe(50);
    expect(clampScore(0)).toBe(0);
    expect(clampScore(100)).toBe(100);
  });
});

describe("buildPillarResult", () => {
  it("creates a valid pillar result with clamped score", () => {
    const result = buildPillarResult("P1", 120, "high", [], "test summary");
    expect(result.pillar).toBe("P1");
    expect(result.score).toBe(100);
    expect(result.confidence).toBe("high");
    expect(result.findings).toEqual([]);
    expect(result.summary).toBe("test summary");
    expect(result.name).toBe("Agent Context Quality");
    expect(result.weight).toBe(0.15);
  });

  it("clamps negative scores to 0", () => {
    const result = buildPillarResult("P2", -5, "medium", [], "summary");
    expect(result.score).toBe(0);
  });
});

describe("anyFileExists", () => {
  it("returns true when any file exists", async () => {
    const ctx = createMockContext({ "a.ts": "", "b.ts": "" });
    expect(await anyFileExists(ctx, ["c.ts", "a.ts"])).toBe(true);
  });

  it("returns false when no files exist", async () => {
    const ctx = createMockContext({});
    expect(await anyFileExists(ctx, ["a.ts", "b.ts"])).toBe(false);
  });

  it("returns false for empty paths array", async () => {
    const ctx = createMockContext({ "a.ts": "" });
    expect(await anyFileExists(ctx, [])).toBe(false);
  });
});

describe("findFirstExisting", () => {
  it("returns the first matching path", async () => {
    const ctx = createMockContext({ "b.ts": "", "c.ts": "" });
    expect(await findFirstExisting(ctx, ["a.ts", "b.ts", "c.ts"])).toBe("b.ts");
  });

  it("returns null when no files exist", async () => {
    const ctx = createMockContext({});
    expect(await findFirstExisting(ctx, ["a.ts"])).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { feedbackLoopAnalyzer } from "../../analyzers/feedback-loop.js";
import { createMockContext } from "../helpers.js";

describe("feedbackLoopAnalyzer (P2)", () => {
  it("always reports pillar P2 with weight 0.15", async () => {
    const ctx = createMockContext({});
    const result = await feedbackLoopAnalyzer.analyze(ctx);
    expect(result.pillar).toBe("P2");
    expect(result.weight).toBe(0.15);
  });

  it("always supports any repo", async () => {
    const ctx = createMockContext({});
    expect(await feedbackLoopAnalyzer.supports(ctx)).toBe(true);
  });

  describe("empty repo (no package.json)", () => {
    it("returns a low score", async () => {
      const ctx = createMockContext({});
      const result = await feedbackLoopAnalyzer.analyze(ctx);
      expect(result.score).toBe(0);
    });

    it("emits ARI-FBK-001 for missing test command", async () => {
      const ctx = createMockContext({});
      const result = await feedbackLoopAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-FBK-001")).toBe(true);
    });

    it("has low confidence without package.json", async () => {
      const ctx = createMockContext({});
      const result = await feedbackLoopAnalyzer.analyze(ctx);
      expect(result.confidence).toBe("low");
    });
  });

  describe("repo with Makefile but no package.json", () => {
    it("gets partial test score from Makefile", async () => {
      const ctx = createMockContext({ Makefile: "test:\n\tpytest" });
      const result = await feedbackLoopAnalyzer.analyze(ctx);
      // Makefile gives 10 points for test
      expect(result.score).toBeGreaterThanOrEqual(10);
    });

    it("does not emit ARI-FBK-001", async () => {
      const ctx = createMockContext({ Makefile: "test:\n\tpytest" });
      const result = await feedbackLoopAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-FBK-001")).toBe(false);
    });
  });

  describe("repo with full scripts (test, lint, typecheck, build)", () => {
    const fullPkg = JSON.stringify({
      scripts: {
        test: "vitest run",
        "test:watch": "vitest",
        lint: "eslint src/",
        typecheck: "tsc --noEmit",
        build: "tsup",
      },
    });

    it("scores high", async () => {
      const ctx = createMockContext({ "package.json": fullPkg });
      const result = await ctx.readJson("package.json");
      expect(result).toBeTruthy();

      const analysisResult = await feedbackLoopAnalyzer.analyze(
        createMockContext({ "package.json": fullPkg }),
      );
      // test: 20, test:watch: 5, lint: 15, typecheck: 15, build: 10 = 65
      expect(analysisResult.score).toBeGreaterThanOrEqual(65);
    });

    it("has high confidence with package.json present", async () => {
      const ctx = createMockContext({ "package.json": fullPkg });
      const result = await feedbackLoopAnalyzer.analyze(ctx);
      expect(result.confidence).toBe("high");
    });

    it("does not emit ARI-FBK-001 or ARI-FBK-002", async () => {
      const ctx = createMockContext({ "package.json": fullPkg });
      const result = await feedbackLoopAnalyzer.analyze(ctx);
      const codes = result.findings.map((f) => f.code);
      expect(codes).not.toContain("ARI-FBK-001");
      expect(codes).not.toContain("ARI-FBK-002");
    });
  });

  describe("CI configuration detection", () => {
    it("adds CI points for .github/workflows/ci.yml", async () => {
      const pkg = JSON.stringify({ scripts: {} });
      const ctxWithCI = createMockContext({
        "package.json": pkg,
        ".github/workflows/ci.yml": "name: CI\non: push",
      });
      const ctxWithoutCI = createMockContext({
        "package.json": pkg,
      });

      const withCI = await feedbackLoopAnalyzer.analyze(ctxWithCI);
      const withoutCI = await feedbackLoopAnalyzer.analyze(ctxWithoutCI);

      expect(withCI.score).toBeGreaterThan(withoutCI.score);
      // CI adds 15 points
      expect(withCI.score - withoutCI.score).toBe(15);
    });

    it("emits ARI-FBK-004 when no CI config found", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: { test: "vitest" } }),
      });
      const result = await feedbackLoopAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-FBK-004")).toBe(true);
    });

    it("does not emit ARI-FBK-004 when CI config exists", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: {} }),
        ".github/workflows/ci.yml": "name: CI",
      });
      const result = await feedbackLoopAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-FBK-004")).toBe(false);
    });
  });

  describe("turbo.json incremental build detection", () => {
    it("adds points for turbo.json", async () => {
      const pkg = JSON.stringify({ scripts: {} });
      const ctxWith = createMockContext({
        "package.json": pkg,
        "turbo.json": JSON.stringify({ pipeline: {} }),
      });
      const ctxWithout = createMockContext({ "package.json": pkg });

      const withTurbo = await feedbackLoopAnalyzer.analyze(ctxWith);
      const withoutTurbo = await feedbackLoopAnalyzer.analyze(ctxWithout);

      expect(withTurbo.score).toBeGreaterThan(withoutTurbo.score);
    });
  });

  describe("pre-commit hooks detection", () => {
    it("adds points for .husky directory", async () => {
      const pkg = JSON.stringify({ scripts: {} });
      const ctxWith = createMockContext({
        "package.json": pkg,
        ".husky/pre-commit": "#!/bin/sh\npnpm lint",
      });
      const ctxWithout = createMockContext({ "package.json": pkg });

      const withHusky = await feedbackLoopAnalyzer.analyze(ctxWith);
      const withoutHusky = await feedbackLoopAnalyzer.analyze(ctxWithout);

      expect(withHusky.score).toBeGreaterThan(withoutHusky.score);
      // Hooks add 10 points
      expect(withHusky.score - withoutHusky.score).toBe(10);
    });

    it("adds points for .pre-commit-config.yaml", async () => {
      const pkg = JSON.stringify({ scripts: {} });
      const ctxWith = createMockContext({
        "package.json": pkg,
        ".pre-commit-config.yaml": "repos:\n  - repo: ...",
      });
      const ctxWithout = createMockContext({ "package.json": pkg });

      const withHook = await feedbackLoopAnalyzer.analyze(ctxWith);
      const withoutHook = await feedbackLoopAnalyzer.analyze(ctxWithout);
      expect(withHook.score).toBeGreaterThan(withoutHook.score);
    });
  });

  describe("modern build tool bonus", () => {
    it("adds bonus for vite/esbuild/tsup in build script", async () => {
      const modernPkg = JSON.stringify({ scripts: { build: "tsup src/index.ts" } });
      const legacyPkg = JSON.stringify({ scripts: { build: "tsc" } });

      const modern = await feedbackLoopAnalyzer.analyze(createMockContext({ "package.json": modernPkg }));
      const legacy = await feedbackLoopAnalyzer.analyze(createMockContext({ "package.json": legacyPkg }));

      // Modern gets build (10) + modern bonus (5), legacy gets build (10) only
      expect(modern.score).toBeGreaterThan(legacy.score);
    });
  });

  describe("TypeScript project without typecheck script", () => {
    it("emits ARI-FBK-003", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: { test: "vitest" } }),
        "tsconfig.json": JSON.stringify({ compilerOptions: { strict: true } }),
      });
      const result = await feedbackLoopAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-FBK-003")).toBe(true);
    });
  });

  describe("score clamping", () => {
    it("never exceeds 100", async () => {
      const maxPkg = JSON.stringify({
        scripts: {
          test: "vitest run",
          "test:watch": "vitest",
          lint: "eslint .",
          typecheck: "tsc --noEmit",
          build: "turbo run build",
        },
      });
      const ctx = createMockContext({
        "package.json": maxPkg,
        ".github/workflows/ci.yml": "name: CI",
        ".husky/pre-commit": "lint-staged",
        "turbo.json": "{}",
      });
      const result = await feedbackLoopAnalyzer.analyze(ctx);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });
});

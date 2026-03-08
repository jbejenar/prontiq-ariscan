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
      expect(result.score).toBeGreaterThanOrEqual(1);
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
      // Local signals contribute heavily with 2x weighting
      expect(analysisResult.score).toBeGreaterThanOrEqual(50);
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

    it("emits ARI-FBK-008 info for turbo.json", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: {} }),
        "turbo.json": JSON.stringify({ pipeline: {} }),
      });
      const result = await feedbackLoopAnalyzer.analyze(ctx);
      const fbk008 = result.findings.find((f) => f.code === "ARI-FBK-008");
      expect(fbk008).toBeDefined();
      expect(fbk008?.severity).toBe("info");
      expect(fbk008?.message).toContain("turbo");
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

      const modern = await feedbackLoopAnalyzer.analyze(
        createMockContext({ "package.json": modernPkg }),
      );
      const legacy = await feedbackLoopAnalyzer.analyze(
        createMockContext({ "package.json": legacyPkg }),
      );

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

  describe("estimated execution time categories", () => {
    it("gives bonus for vitest config (fast by default)", async () => {
      const pkg = JSON.stringify({ scripts: { test: "vitest run" } });
      const ctxWith = createMockContext({
        "package.json": pkg,
        "vitest.config.ts": "export default { test: { timeout: 5000 } }",
      });
      const ctxWithout = createMockContext({
        "package.json": pkg,
      });
      const withConfig = await feedbackLoopAnalyzer.analyze(ctxWith);
      const withoutConfig = await feedbackLoopAnalyzer.analyze(ctxWithout);
      expect(withConfig.score).toBeGreaterThan(withoutConfig.score);
    });

    it("emits ARI-FBK-005 for slow test timeout (>60s)", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: { test: "vitest run" } }),
        "vitest.config.ts": "export default { test: { timeout: 120000 } }",
      });
      const result = await feedbackLoopAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-FBK-005")).toBe(true);
    });

    it("does not emit ARI-FBK-005 for fast test timeout", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: { test: "vitest run" } }),
        "vitest.config.ts": "export default { test: { timeout: 5000 } }",
      });
      const result = await feedbackLoopAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-FBK-005")).toBe(false);
    });

    it("emits ARI-FBK-009 with latency estimate", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: { test: "vitest run" } }),
        "vitest.config.ts": "export default { test: { timeout: 5000 } }",
      });
      const result = await feedbackLoopAnalyzer.analyze(ctx);
      const fbk009 = result.findings.find((f) => f.code === "ARI-FBK-009");
      expect(fbk009).toBeDefined();
      expect(fbk009?.severity).toBe("info");
      expect(fbk009?.message).toContain("measured");
    });

    it("emits ARI-FBK-009 with inferred label for vitest without explicit timeout", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: { test: "vitest run" } }),
        "vitest.config.ts": "export default { test: {} }",
      });
      const result = await feedbackLoopAnalyzer.analyze(ctx);
      const fbk009 = result.findings.find((f) => f.code === "ARI-FBK-009");
      expect(fbk009).toBeDefined();
      expect(fbk009?.message).toContain("inferred");
    });

    it("emits ARI-FBK-009 with unknown label when no config", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: {} }),
      });
      const result = await feedbackLoopAnalyzer.analyze(ctx);
      const fbk009 = result.findings.find((f) => f.code === "ARI-FBK-009");
      expect(fbk009).toBeDefined();
      expect(fbk009?.message).toContain("unknown");
    });

    it("infers latency from test command when no config file", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: { test: "jest --coverage" } }),
      });
      const result = await feedbackLoopAnalyzer.analyze(ctx);
      const fbk009 = result.findings.find((f) => f.code === "ARI-FBK-009");
      expect(fbk009).toBeDefined();
      expect(fbk009?.message).toContain("inferred");
      expect(fbk009?.message).toContain("jest");
    });
  });

  describe("changeset scope controls", () => {
    it("adds points for commitlint config", async () => {
      const pkg = JSON.stringify({ scripts: {} });
      const ctxWith = createMockContext({
        "package.json": pkg,
        "commitlint.config.js":
          "module.exports = { extends: ['@commitlint/config-conventional'] };",
      });
      const ctxWithout = createMockContext({ "package.json": pkg });
      const withCommitlint = await feedbackLoopAnalyzer.analyze(ctxWith);
      const withoutCommitlint = await feedbackLoopAnalyzer.analyze(ctxWithout);
      expect(withCommitlint.score).toBeGreaterThan(withoutCommitlint.score);
    });

    it("adds points for .changeset/config.json", async () => {
      const pkg = JSON.stringify({ scripts: {} });
      const ctxWith = createMockContext({
        "package.json": pkg,
        ".changeset/config.json": JSON.stringify({ changelog: "@changesets/cli" }),
      });
      const ctxWithout = createMockContext({ "package.json": pkg });
      const withChangesets = await feedbackLoopAnalyzer.analyze(ctxWith);
      const withoutChangesets = await feedbackLoopAnalyzer.analyze(ctxWithout);
      expect(withChangesets.score).toBeGreaterThan(withoutChangesets.score);
    });

    it("adds points for commitlint in package.json", async () => {
      const pkg = JSON.stringify({
        scripts: {},
        commitlint: { extends: ["@commitlint/config-conventional"] },
      });
      const ctxWith = createMockContext({ "package.json": pkg });
      const ctxWithout = createMockContext({ "package.json": JSON.stringify({ scripts: {} }) });
      const withCommitlint = await feedbackLoopAnalyzer.analyze(ctxWith);
      const withoutCommitlint = await feedbackLoopAnalyzer.analyze(ctxWithout);
      expect(withCommitlint.score).toBeGreaterThan(withoutCommitlint.score);
    });

    it("emits ARI-FBK-006 when no changeset controls", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: {} }),
      });
      const result = await feedbackLoopAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-FBK-006")).toBe(true);
    });
  });

  describe("watch mode finding (ARI-FBK-007)", () => {
    it("emits info when watch mode detected", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: { test: "vitest run", "test:watch": "vitest" } }),
      });
      const result = await feedbackLoopAnalyzer.analyze(ctx);
      const fbk007 = result.findings.find((f) => f.code === "ARI-FBK-007");
      expect(fbk007).toBeDefined();
      expect(fbk007?.severity).toBe("info");
      expect(fbk007?.message).toContain("Watch mode detected");
    });

    it("emits low severity when no watch mode", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: { test: "vitest run" } }),
      });
      const result = await feedbackLoopAnalyzer.analyze(ctx);
      const fbk007 = result.findings.find((f) => f.code === "ARI-FBK-007");
      expect(fbk007).toBeDefined();
      expect(fbk007?.severity).toBe("low");
      expect(fbk007?.message).toContain("No watch mode");
    });
  });

  describe("incremental build finding (ARI-FBK-008)", () => {
    it("emits info when turbo detected", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: {} }),
        "turbo.json": "{}",
      });
      const result = await feedbackLoopAnalyzer.analyze(ctx);
      const fbk008 = result.findings.find((f) => f.code === "ARI-FBK-008");
      expect(fbk008).toBeDefined();
      expect(fbk008?.severity).toBe("info");
      expect(fbk008?.message).toContain("turbo");
    });

    it("emits info when nx detected", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: {} }),
        "nx.json": "{}",
      });
      const result = await feedbackLoopAnalyzer.analyze(ctx);
      const fbk008 = result.findings.find((f) => f.code === "ARI-FBK-008");
      expect(fbk008).toBeDefined();
      expect(fbk008?.severity).toBe("info");
      expect(fbk008?.message).toContain("nx");
    });

    it("emits low severity when no incremental build", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: {} }),
      });
      const result = await feedbackLoopAnalyzer.analyze(ctx);
      const fbk008 = result.findings.find((f) => f.code === "ARI-FBK-008");
      expect(fbk008).toBeDefined();
      expect(fbk008?.severity).toBe("low");
      expect(fbk008?.message).toContain("No incremental");
    });
  });

  describe("local vs CI weight differentiation", () => {
    it("local feedback contributes more than CI feedback to score", async () => {
      // Repo with only CI config (no local scripts)
      const ciOnly = createMockContext({
        "package.json": JSON.stringify({ scripts: {} }),
        ".github/workflows/ci.yml": "name: CI",
      });
      // Repo with only local test script (no CI)
      const localOnly = createMockContext({
        "package.json": JSON.stringify({ scripts: { test: "vitest run" } }),
      });
      const ciResult = await feedbackLoopAnalyzer.analyze(ciOnly);
      const localResult = await feedbackLoopAnalyzer.analyze(localOnly);
      // Local feedback has 2x weight, so local-only should score higher than CI-only
      expect(localResult.score).toBeGreaterThan(ciResult.score);
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

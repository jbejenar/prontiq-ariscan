import { describe, it, expect } from "vitest";
import { buildDeterminismAnalyzer } from "../../analyzers/build-determinism.js";
import { createMockContext } from "../helpers.js";

describe("buildDeterminismAnalyzer (P6)", () => {
  it("always reports pillar P6 with weight 0.15", async () => {
    const ctx = createMockContext({});
    const result = await buildDeterminismAnalyzer.analyze(ctx);
    expect(result.pillar).toBe("P6");
    expect(result.weight).toBe(0.15);
  });

  it("always supports any repo", async () => {
    const ctx = createMockContext({});
    expect(await buildDeterminismAnalyzer.supports(ctx)).toBe(true);
  });

  describe("repo with no tsconfig (checks for other languages)", () => {
    it("detects Go projects via go.mod", async () => {
      const ctx = createMockContext({
        "go.mod": "module example.com/app\ngo 1.21",
        "go.sum": "some hash",
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      // Go: 25 + lockfile(go.sum): 20 = 45
      expect(result.score).toBeGreaterThanOrEqual(45);
    });

    it("detects Rust projects via Cargo.toml", async () => {
      const ctx = createMockContext({
        "Cargo.toml": '[package]\nname = "app"',
        "Cargo.lock": "some lock data",
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      // Rust: 30 + lockfile: 20 = 50
      expect(result.score).toBeGreaterThanOrEqual(50);
    });

    it("detects Python typing via mypy.ini", async () => {
      const ctx = createMockContext({
        "mypy.ini": "[mypy]\nstrict = true",
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      // mypy: 20
      expect(result.score).toBeGreaterThanOrEqual(20);
    });

    it("detects Python typing in pyproject.toml", async () => {
      const ctx = createMockContext({
        "pyproject.toml": "[tool.mypy]\nstrict = true",
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.score).toBeGreaterThanOrEqual(20);
    });
  });

  describe("repo with tsconfig strict: true", () => {
    it("scores >= 30 from strict mode alone", async () => {
      const ctx = createMockContext({
        "tsconfig.json": JSON.stringify({
          compilerOptions: { strict: true },
        }),
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.score).toBeGreaterThanOrEqual(30);
    });

    it("does not emit ARI-BLD-001", async () => {
      const ctx = createMockContext({
        "tsconfig.json": JSON.stringify({
          compilerOptions: { strict: true },
        }),
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-BLD-001")).toBe(false);
    });

    it("has high confidence with tsconfig present", async () => {
      const ctx = createMockContext({
        "tsconfig.json": JSON.stringify({
          compilerOptions: { strict: true },
        }),
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.confidence).toBe("high");
    });
  });

  describe("repo with tsconfig strict: false", () => {
    it("emits ARI-BLD-001 finding when strict is not enabled", async () => {
      const ctx = createMockContext({
        "tsconfig.json": JSON.stringify({
          compilerOptions: { strict: false },
        }),
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-BLD-001")).toBe(true);
    });

    it("gives partial credit for strictNullChecks only", async () => {
      const ctx = createMockContext({
        "tsconfig.json": JSON.stringify({
          compilerOptions: { strictNullChecks: true },
        }),
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      // strictNullChecks alone: 10 + ARI-BLD-001
      expect(result.score).toBeGreaterThanOrEqual(10);
      expect(result.findings.some((f) => f.code === "ARI-BLD-001")).toBe(true);
    });

    it("gives more credit for both strictNullChecks + noImplicitAny", async () => {
      const ctx = createMockContext({
        "tsconfig.json": JSON.stringify({
          compilerOptions: { strictNullChecks: true, noImplicitAny: true },
        }),
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      // Both: 20
      expect(result.score).toBeGreaterThanOrEqual(20);
    });
  });

  describe("lockfile detection", () => {
    it("adds points for pnpm-lock.yaml", async () => {
      const withLock = createMockContext({
        "tsconfig.json": JSON.stringify({ compilerOptions: { strict: true } }),
        "pnpm-lock.yaml": "lockfileVersion: 5",
      });
      const withoutLock = createMockContext({
        "tsconfig.json": JSON.stringify({ compilerOptions: { strict: true } }),
      });

      const lockResult = await buildDeterminismAnalyzer.analyze(withLock);
      const noLockResult = await buildDeterminismAnalyzer.analyze(withoutLock);
      expect(lockResult.score - noLockResult.score).toBe(20);
    });

    it("detects various lockfile formats", async () => {
      for (const lockfile of ["package-lock.json", "yarn.lock", "bun.lockb", "poetry.lock"]) {
        const ctx = createMockContext({ [lockfile]: "lock content" });
        const result = await buildDeterminismAnalyzer.analyze(ctx);
        // Should get lockfile points (20)
        expect(result.score).toBeGreaterThanOrEqual(20);
      }
    });
  });

  describe("lockfile in .gitignore", () => {
    it("emits ARI-BLD-002 when lockfile is gitignored", async () => {
      const ctx = createMockContext({
        ".gitignore": "node_modules/\npackage-lock.json\n",
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-BLD-002")).toBe(true);
    });

    it("emits ARI-BLD-003 when no lockfile and not gitignored", async () => {
      const ctx = createMockContext({
        ".gitignore": "node_modules/\ndist/\n",
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-BLD-003")).toBe(true);
    });

    it("does not emit ARI-BLD-002 or ARI-BLD-003 when lockfile exists", async () => {
      const ctx = createMockContext({
        "pnpm-lock.yaml": "lockfileVersion: 5",
        ".gitignore": "node_modules/\n",
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-BLD-002")).toBe(false);
      expect(result.findings.some((f) => f.code === "ARI-BLD-003")).toBe(false);
    });
  });

  describe("turbo.json reproducibility points", () => {
    it("adds points for turbo.json", async () => {
      const withTurbo = createMockContext({
        "tsconfig.json": JSON.stringify({ compilerOptions: { strict: true } }),
        "turbo.json": JSON.stringify({ pipeline: { build: {} } }),
      });
      const withoutTurbo = createMockContext({
        "tsconfig.json": JSON.stringify({ compilerOptions: { strict: true } }),
      });

      const turboResult = await buildDeterminismAnalyzer.analyze(withTurbo);
      const noTurboResult = await buildDeterminismAnalyzer.analyze(withoutTurbo);
      expect(turboResult.score).toBeGreaterThan(noTurboResult.score);
    });
  });

  describe("build tool detection", () => {
    it("adds points for having a build script", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: { build: "tsc" } }),
      });
      const noScripts = createMockContext({
        "package.json": JSON.stringify({ scripts: {} }),
      });

      const buildResult = await buildDeterminismAnalyzer.analyze(ctx);
      const noResult = await buildDeterminismAnalyzer.analyze(noScripts);
      expect(buildResult.score).toBeGreaterThan(noResult.score);
    });

    it("gives bonus for modern build tools (tsup, esbuild, vite)", async () => {
      const modernPkg = JSON.stringify({ scripts: { build: "tsup src/index.ts" } });
      const legacyPkg = JSON.stringify({ scripts: { build: "tsc" } });

      const modern = await buildDeterminismAnalyzer.analyze(createMockContext({ "package.json": modernPkg }));
      const legacy = await buildDeterminismAnalyzer.analyze(createMockContext({ "package.json": legacyPkg }));
      // Modern: build(10) + modern bonus(10), legacy: build(10)
      expect(modern.score).toBeGreaterThan(legacy.score);
    });

    it("gives partial bonus for webpack", async () => {
      const webpackPkg = JSON.stringify({ scripts: { build: "webpack --mode production" } });
      const tsupPkg = JSON.stringify({ scripts: { build: "tsup" } });

      const webpack = await buildDeterminismAnalyzer.analyze(createMockContext({ "package.json": webpackPkg }));
      const tsup = await buildDeterminismAnalyzer.analyze(createMockContext({ "package.json": tsupPkg }));
      // webpack: build(10) + webpack(5), tsup: build(10) + modern(10)
      expect(tsup.score).toBeGreaterThan(webpack.score);
    });
  });

  describe("package manager consistency", () => {
    it("adds points for .npmrc", async () => {
      const with_ = createMockContext({ ".npmrc": "save-exact=true" });
      const without_ = createMockContext({});
      const r1 = await buildDeterminismAnalyzer.analyze(with_);
      const r2 = await buildDeterminismAnalyzer.analyze(without_);
      expect(r1.score).toBeGreaterThan(r2.score);
    });

    it("adds points for packageManager field", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ packageManager: "pnpm@9.0.0" }),
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      // Should include package manager consistency points
      expect(result.score).toBeGreaterThanOrEqual(5);
    });
  });

  describe("isolatedModules bonus", () => {
    it("adds 5 points for isolatedModules: true", async () => {
      const with_ = createMockContext({
        "tsconfig.json": JSON.stringify({
          compilerOptions: { strict: true, isolatedModules: true },
        }),
      });
      const without_ = createMockContext({
        "tsconfig.json": JSON.stringify({
          compilerOptions: { strict: true },
        }),
      });

      const r1 = await buildDeterminismAnalyzer.analyze(with_);
      const r2 = await buildDeterminismAnalyzer.analyze(without_);
      expect(r1.score - r2.score).toBe(5);
    });
  });

  describe("score clamping", () => {
    it("never exceeds 100", async () => {
      const ctx = createMockContext({
        "tsconfig.json": JSON.stringify({
          compilerOptions: { strict: true, isolatedModules: true },
        }),
        "pnpm-lock.yaml": "lockfileVersion: 5",
        "package.json": JSON.stringify({
          scripts: { build: "tsup" },
          packageManager: "pnpm@9.0.0",
        }),
        "turbo.json": "{}",
        ".npmrc": "save-exact=true",
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });
});

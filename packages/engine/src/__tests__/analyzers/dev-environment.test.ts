import { describe, it, expect } from "vitest";
import { devEnvironmentAnalyzer } from "../../analyzers/dev-environment.js";
import { createMockContext } from "../helpers.js";

describe("devEnvironmentAnalyzer (P4)", () => {
  it("always reports pillar P4 with weight 0.10", async () => {
    const ctx = createMockContext({});
    const result = await devEnvironmentAnalyzer.analyze(ctx);
    expect(result.pillar).toBe("P4");
    expect(result.weight).toBe(0.10);
  });

  it("always supports any repo", async () => {
    const ctx = createMockContext({});
    expect(await devEnvironmentAnalyzer.supports(ctx)).toBe(true);
  });

  describe("empty repo", () => {
    it("returns a low score", async () => {
      const ctx = createMockContext({});
      const result = await devEnvironmentAnalyzer.analyze(ctx);
      expect(result.score).toBeLessThanOrEqual(10);
    });
  });

  describe("devcontainer detection", () => {
    it("adds points for devcontainer.json", async () => {
      const with_ = createMockContext({
        ".devcontainer/devcontainer.json": JSON.stringify({ name: "dev" }),
      });
      const without_ = createMockContext({});
      const r1 = await devEnvironmentAnalyzer.analyze(with_);
      const r2 = await devEnvironmentAnalyzer.analyze(without_);
      expect(r1.score).toBeGreaterThan(r2.score);
    });
  });

  describe("doctor/health-check command detection", () => {
    it("adds points for a 'doctor' script", async () => {
      const withDoctor = createMockContext({
        "package.json": JSON.stringify({ scripts: { doctor: "node scripts/doctor.js" } }),
      });
      const withoutDoctor = createMockContext({
        "package.json": JSON.stringify({ scripts: {} }),
      });
      const r1 = await devEnvironmentAnalyzer.analyze(withDoctor);
      const r2 = await devEnvironmentAnalyzer.analyze(withoutDoctor);
      expect(r1.score).toBeGreaterThan(r2.score);
    });

    it("adds points for a 'health' script", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: { "health-check": "node scripts/health.js" } }),
      });
      const result = await devEnvironmentAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-ENV-004")).toBe(false);
    });

    it("detects doctor in script value", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: { validate: "npx doctor-check" } }),
      });
      const result = await devEnvironmentAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-ENV-004")).toBe(false);
    });

    it("emits ARI-ENV-004 when no doctor/health script exists", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: { test: "vitest", build: "tsc" } }),
      });
      const result = await devEnvironmentAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-ENV-004")).toBe(true);
    });
  });

  describe("seed/fixture data detection", () => {
    it("adds points for seeds/ directory", async () => {
      const with_ = createMockContext({
        "package.json": JSON.stringify({ scripts: {} }),
        "seeds/users.json": '[{"name": "test"}]',
      });
      const without_ = createMockContext({
        "package.json": JSON.stringify({ scripts: {} }),
      });
      const r1 = await devEnvironmentAnalyzer.analyze(with_);
      const r2 = await devEnvironmentAnalyzer.analyze(without_);
      expect(r1.score).toBeGreaterThan(r2.score);
    });

    it("adds points for fixtures/ directory", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: {} }),
        "fixtures/sample.json": "{}",
      });
      const baseline = createMockContext({
        "package.json": JSON.stringify({ scripts: {} }),
      });
      const r1 = await devEnvironmentAnalyzer.analyze(ctx);
      const r2 = await devEnvironmentAnalyzer.analyze(baseline);
      expect(r1.score).toBeGreaterThan(r2.score);
    });

    it("adds points for testdata/ directory", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: {} }),
        "testdata/input.json": "{}",
      });
      const baseline = createMockContext({
        "package.json": JSON.stringify({ scripts: {} }),
      });
      const r1 = await devEnvironmentAnalyzer.analyze(ctx);
      const r2 = await devEnvironmentAnalyzer.analyze(baseline);
      expect(r1.score).toBeGreaterThan(r2.score);
    });

    it("detects seed script in package.json", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: { "db:seed": "node seeds/run.js" } }),
      });
      const baseline = createMockContext({
        "package.json": JSON.stringify({ scripts: {} }),
      });
      const r1 = await devEnvironmentAnalyzer.analyze(ctx);
      const r2 = await devEnvironmentAnalyzer.analyze(baseline);
      expect(r1.score).toBeGreaterThan(r2.score);
    });
  });

  describe("score clamping", () => {
    it("never exceeds 100", async () => {
      const ctx = createMockContext({
        ".devcontainer/devcontainer.json": JSON.stringify({
          name: "dev",
          postCreateCommand: "pnpm install",
          features: { "ghcr.io/devcontainers/features/node:1": {} },
        }),
        "docker-compose.yml": "version: '3'",
        "scripts/setup.sh": "#!/bin/bash\necho setup",
        "package.json": JSON.stringify({
          scripts: { setup: "bash scripts/setup.sh", doctor: "node doctor.js", "db:seed": "node seed.js" },
          engines: { node: ">=18" },
        }),
        ".nvmrc": "18",
        ".env.example": "DB_URL=postgres://...",
        "README.md": "# App\n## Getting Started\nRun setup.",
        "CONTRIBUTING.md": "# Contributing\nFork and PR.",
        "seeds/data.json": "[]",
      });
      const result = await devEnvironmentAnalyzer.analyze(ctx);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });
});

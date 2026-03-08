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

  describe("devcontainer validation (ARI-ENV-005)", () => {
    it("reports pass when devcontainer has image and lifecycle command", async () => {
      const ctx = createMockContext({
        ".devcontainer/devcontainer.json": JSON.stringify({
          name: "dev",
          image: "mcr.microsoft.com/devcontainers/typescript-node:1-20",
          postCreateCommand: "pnpm install",
        }),
      });
      const result = await devEnvironmentAnalyzer.analyze(ctx);
      const statusFinding = result.findings.find(
        (f) => f.code === "ARI-ENV-005" && f.severity === "info",
      );
      expect(statusFinding).toBeDefined();
      expect(statusFinding?.message).toContain("pass");
    });

    it("reports partial when devcontainer missing image/build", async () => {
      const ctx = createMockContext({
        ".devcontainer/devcontainer.json": JSON.stringify({
          name: "dev",
          postCreateCommand: "pnpm install",
        }),
      });
      const result = await devEnvironmentAnalyzer.analyze(ctx);
      // Should emit a medium severity finding for missing image/build
      const mediumFinding = result.findings.find(
        (f) => f.code === "ARI-ENV-005" && f.severity === "medium",
      );
      expect(mediumFinding).toBeDefined();
      expect(mediumFinding?.message).toContain("missing");
      // Info finding should show partial
      const statusFinding = result.findings.find(
        (f) => f.code === "ARI-ENV-005" && f.severity === "info",
      );
      expect(statusFinding?.message).toContain("partial");
    });

    it("reports fail when no devcontainer exists", async () => {
      const ctx = createMockContext({});
      const result = await devEnvironmentAnalyzer.analyze(ctx);
      const statusFinding = result.findings.find(
        (f) => f.code === "ARI-ENV-005" && f.severity === "info",
      );
      expect(statusFinding).toBeDefined();
      expect(statusFinding?.message).toContain("fail");
    });

    it("adds bonus for settings field", async () => {
      const withSettings = createMockContext({
        ".devcontainer/devcontainer.json": JSON.stringify({
          name: "dev",
          image: "node:20",
          settings: { "editor.formatOnSave": true },
        }),
      });
      const withoutSettings = createMockContext({
        ".devcontainer/devcontainer.json": JSON.stringify({
          name: "dev",
          image: "node:20",
        }),
      });
      const r1 = await devEnvironmentAnalyzer.analyze(withSettings);
      const r2 = await devEnvironmentAnalyzer.analyze(withoutSettings);
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

  describe("first-run blockers (ARI-ENV-006)", () => {
    it("detects missing .env.example when code uses process.env", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: {} }),
        "src/config.ts": "const dbUrl = process.env.DATABASE_URL;",
      });
      const result = await devEnvironmentAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-ENV-006" && f.severity === "high");
      expect(finding).toBeDefined();
      expect(finding?.message).toContain(".env.example");
    });

    it("does not flag when .env.example exists", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: {} }),
        "src/config.ts": "const dbUrl = process.env.DATABASE_URL;",
        ".env.example": "DATABASE_URL=postgres://localhost/dev",
      });
      const result = await devEnvironmentAnalyzer.analyze(ctx);
      const blocker = result.findings.find((f) => f.code === "ARI-ENV-006" && f.severity === "high");
      // Should not flag missing .env.example
      if (blocker) {
        expect(blocker.message).not.toContain(".env.example");
      }
    });

    it("detects missing install command", async () => {
      // No package.json, no Makefile, no requirements.txt, no go.mod
      const ctx = createMockContext({
        "src/main.py": "print('hello')",
      });
      const result = await devEnvironmentAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-ENV-006" && f.severity === "high");
      expect(finding).toBeDefined();
      expect(finding?.message).toContain("No install command");
    });

    it("detects TypeScript without tsconfig", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: {} }),
        "src/index.ts": "export const x = 1;",
      });
      const result = await devEnvironmentAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-ENV-006" && f.severity === "high");
      expect(finding).toBeDefined();
      expect(finding?.message).toContain("tsconfig");
    });

    it("reports info when no blockers found", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: {} }),
        "tsconfig.json": "{}",
      });
      const result = await devEnvironmentAnalyzer.analyze(ctx);
      const infoFinding = result.findings.find((f) => f.code === "ARI-ENV-006" && f.severity === "info");
      expect(infoFinding).toBeDefined();
      expect(infoFinding?.message).toContain("No obvious first-run blockers");
    });
  });

  describe("environment variable completeness (ARI-ENV-007)", () => {
    it("detects vars in code but missing from .env.example", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: {} }),
        ".env.example": "DATABASE_URL=postgres://localhost/dev",
        "src/config.ts": `
          const db = process.env.DATABASE_URL;
          const redis = process.env.REDIS_URL;
          const secret = process.env.API_SECRET;
        `,
      });
      const result = await devEnvironmentAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-ENV-007" && f.severity === "medium");
      expect(finding).toBeDefined();
      expect(finding?.message).toContain("REDIS_URL");
      expect(finding?.message).toContain("API_SECRET");
    });

    it("reports info when all vars are documented", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: {} }),
        ".env.example": "DATABASE_URL=postgres://localhost/dev\nREDIS_URL=redis://localhost",
        "src/config.ts": `
          const db = process.env.DATABASE_URL;
          const redis = process.env.REDIS_URL;
        `,
      });
      const result = await devEnvironmentAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-ENV-007" && f.severity === "info");
      expect(finding).toBeDefined();
      expect(finding?.message).toContain("all referenced vars documented");
    });

    it("ignores NODE_ENV and other builtins", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: {} }),
        ".env.example": "APP_PORT=3000",
        "src/config.ts": `
          const env = process.env.NODE_ENV;
          const port = process.env.APP_PORT;
        `,
      });
      const result = await devEnvironmentAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-ENV-007" && f.severity === "info");
      expect(finding).toBeDefined();
    });

    it("flags when no .env.example but code uses process.env", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: {} }),
        "src/config.ts": "const x = process.env.MY_SECRET;",
      });
      const result = await devEnvironmentAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-ENV-007" && f.severity === "medium");
      expect(finding).toBeDefined();
      expect(finding?.message).toContain("No .env.example");
    });
  });

  describe("per-criterion status labels", () => {
    it("emits info findings for each criterion", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: { setup: "bash setup.sh" } }),
        ".nvmrc": "20",
        ".env.example": "DB=x",
      });
      const result = await devEnvironmentAnalyzer.analyze(ctx);
      const codes = result.findings.map((f) => f.code);
      // Per-criterion status findings
      expect(codes).toContain("ARI-ENV-005"); // devcontainer status
      expect(codes).toContain("ARI-ENV-008"); // setup scripts
      expect(codes).toContain("ARI-ENV-009"); // version pinning
      expect(codes).toContain("ARI-ENV-010"); // docker compose
      expect(codes).toContain("ARI-ENV-011"); // env example
      expect(codes).toContain("ARI-ENV-012"); // doctor/health
    });

    it("shows pass for setup scripts when present", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: { setup: "bash setup.sh" } }),
      });
      const result = await devEnvironmentAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-ENV-008");
      expect(finding?.severity).toBe("info");
      expect(finding?.message).toContain("pass");
    });

    it("shows fail for setup scripts when missing", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ scripts: {} }),
      });
      const result = await devEnvironmentAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-ENV-008");
      expect(finding?.severity).toBe("info");
      expect(finding?.message).toContain("fail");
    });
  });

  describe("score clamping", () => {
    it("never exceeds 100", async () => {
      const ctx = createMockContext({
        ".devcontainer/devcontainer.json": JSON.stringify({
          name: "dev",
          image: "node:20",
          postCreateCommand: "pnpm install",
          features: { "ghcr.io/devcontainers/features/node:1": {} },
          settings: { "editor.formatOnSave": true },
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
        "tsconfig.json": "{}",
      });
      const result = await devEnvironmentAnalyzer.analyze(ctx);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it("never goes below 0", async () => {
      // Repo with many first-run blockers
      const ctx = createMockContext({
        "src/index.ts": "const x = process.env.SECRET;",
        "src/config.ts": "const y = process.env.DB_URL;",
      });
      const result = await devEnvironmentAnalyzer.analyze(ctx);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });
});

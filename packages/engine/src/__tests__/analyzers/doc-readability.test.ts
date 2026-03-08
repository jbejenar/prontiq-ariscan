import { describe, it, expect } from "vitest";
import { docReadabilityAnalyzer } from "../../analyzers/doc-readability.js";
import { createMockContext } from "../helpers.js";

describe("docReadabilityAnalyzer (P5)", () => {
  it("always reports pillar P5", async () => {
    const ctx = createMockContext({});
    const result = await docReadabilityAnalyzer.analyze(ctx);
    expect(result.pillar).toBe("P5");
  });

  it("always supports any repo", async () => {
    const ctx = createMockContext({});
    expect(await docReadabilityAnalyzer.supports(ctx)).toBe(true);
  });

  describe("ARI-DOC-002: Machine-readable runbook detection", () => {
    it("gives bonus for YAML runbooks", async () => {
      const ctx = createMockContext({
        "docs/runbook.yaml": "steps:\n  - name: restart\n    command: systemctl restart app",
      });
      const noRunbook = createMockContext({});
      const r1 = await docReadabilityAnalyzer.analyze(ctx);
      const r2 = await docReadabilityAnalyzer.analyze(noRunbook);
      expect(r1.score).toBeGreaterThan(r2.score);
    });

    it("gives bonus for JSON runbooks", async () => {
      const ctx = createMockContext({
        "runbook.json": JSON.stringify({ steps: ["restart", "verify"] }),
      });
      const noRunbook = createMockContext({});
      const r1 = await docReadabilityAnalyzer.analyze(ctx);
      const r2 = await docReadabilityAnalyzer.analyze(noRunbook);
      expect(r1.score).toBeGreaterThan(r2.score);
    });

    it("emits ARI-DOC-002 for prose-only runbooks", async () => {
      const ctx = createMockContext({
        "docs/runbook.md": "# Runbook\n\n## Step 1\nRestart the server",
      });
      const result = await docReadabilityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-DOC-002")).toBe(true);
    });

    it("does not emit ARI-DOC-002 when machine-readable runbooks exist", async () => {
      const ctx = createMockContext({
        "docs/runbook.yaml": "steps:\n  - restart",
      });
      const result = await docReadabilityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-DOC-002")).toBe(false);
    });

    it("does not emit ARI-DOC-002 when no runbooks exist at all", async () => {
      const ctx = createMockContext({});
      const result = await docReadabilityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-DOC-002")).toBe(false);
    });
  });

  describe("ARI-DOC-003: JSDoc coverage measurement", () => {
    it("emits ARI-DOC-003 when < 30% of files have JSDoc", async () => {
      const files: Record<string, string> = {};
      for (let i = 0; i < 10; i++) {
        files[`src/mod${i}.ts`] = `export const x${i} = ${i};`;
      }
      const ctx = createMockContext(files);
      const result = await docReadabilityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-DOC-003")).toBe(true);
    });

    it("does not emit ARI-DOC-003 when >= 30% have JSDoc", async () => {
      const files: Record<string, string> = {};
      for (let i = 0; i < 10; i++) {
        if (i < 4) {
          files[`src/mod${i}.ts`] =
            `/** Does something */\nexport function fn${i}() { return ${i}; }`;
        } else {
          files[`src/mod${i}.ts`] = `export const x${i} = ${i};`;
        }
      }
      const ctx = createMockContext(files);
      const result = await docReadabilityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-DOC-003")).toBe(false);
    });

    it("gives bonus score when >= 50% have JSDoc", async () => {
      const files: Record<string, string> = {};
      for (let i = 0; i < 10; i++) {
        files[`src/mod${i}.ts`] = `/** Documented */\nexport function fn${i}() { return ${i}; }`;
      }
      const ctx = createMockContext(files);
      const noJsdoc: Record<string, string> = {};
      for (let i = 0; i < 10; i++) {
        noJsdoc[`src/mod${i}.ts`] = `export const x${i} = ${i};`;
      }
      const ctxNoJsdoc = createMockContext(noJsdoc);
      const r1 = await docReadabilityAnalyzer.analyze(ctx);
      const r2 = await docReadabilityAnalyzer.analyze(ctxNoJsdoc);
      expect(r1.score).toBeGreaterThan(r2.score);
    });
  });

  describe("ARI-DOC-004: Documentation-code drift detection", () => {
    it("emits ARI-DOC-004 when README references non-existent paths", async () => {
      const ctx = createMockContext({
        "README.md": [
          "# My Project",
          "See `src/foo.ts` for the main logic.",
          "Configuration in `src/config.ts`.",
          "Utils at `src/utils.ts`.",
          "Helpers at `src/helpers.ts`.",
        ].join("\n"),
        // None of the referenced files exist
      });
      const result = await docReadabilityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-DOC-004")).toBe(true);
    });

    it("does not emit ARI-DOC-004 when referenced paths exist", async () => {
      const ctx = createMockContext({
        "README.md": [
          "# My Project",
          "See `src/foo.ts` for the main logic.",
          "Configuration in `src/config.ts`.",
          "Utils at `src/utils.ts`.",
          "Helpers at `src/helpers.ts`.",
        ].join("\n"),
        "src/foo.ts": "export const foo = 1;",
        "src/config.ts": "export const config = {};",
        "src/utils.ts": "export const utils = {};",
        "src/helpers.ts": "export const helpers = {};",
      });
      const result = await docReadabilityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-DOC-004")).toBe(false);
    });

    it("does not emit ARI-DOC-004 when README has no path references", async () => {
      const ctx = createMockContext({
        "README.md": "# My Project\n\nThis is a simple project.",
      });
      const result = await docReadabilityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-DOC-004")).toBe(false);
    });

    it("does not emit ARI-DOC-004 for directory references that exist", async () => {
      const ctx = createMockContext({
        "README.md": [
          "# My Project",
          "See `packages/schema/` for types.",
          "See `packages/engine/` for the engine.",
          "See `packages/cli/` for the CLI.",
        ].join("\n"),
        "packages/schema/src/index.ts": "export type Foo = string;",
        "packages/engine/src/index.ts": "export const engine = {};",
        "packages/cli/src/cli.ts": "console.log('hello');",
      });
      const result = await docReadabilityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-DOC-004")).toBe(false);
    });
  });

  describe("monorepo env validation detection", () => {
    it("detects zod in workspace package.json", async () => {
      const withWorkspaceZod = createMockContext({
        "package.json": JSON.stringify({ name: "root" }),
        "packages/schema/package.json": JSON.stringify({
          dependencies: { zod: "^3.0.0" },
        }),
      });
      const withoutZod = createMockContext({
        "package.json": JSON.stringify({ name: "root" }),
      });
      const r1 = await docReadabilityAnalyzer.analyze(withWorkspaceZod);
      const r2 = await docReadabilityAnalyzer.analyze(withoutZod);
      expect(r1.score).toBeGreaterThan(r2.score);
    });
  });

  describe("type export detection", () => {
    it("detects .schema.ts files", async () => {
      const withSchema = createMockContext({
        "src/user.schema.ts": "export const userSchema = {};",
      });
      const without = createMockContext({});
      const r1 = await docReadabilityAnalyzer.analyze(withSchema);
      const r2 = await docReadabilityAnalyzer.analyze(without);
      expect(r1.score).toBeGreaterThan(r2.score);
    });

    it("detects files in types/ directory", async () => {
      const withTypes = createMockContext({
        "src/types/user.ts": "export type User = { name: string };",
      });
      const without = createMockContext({});
      const r1 = await docReadabilityAnalyzer.analyze(withTypes);
      const r2 = await docReadabilityAnalyzer.analyze(without);
      expect(r1.score).toBeGreaterThan(r2.score);
    });

    it("detects Zod schema usage in source files", async () => {
      const withZod = createMockContext({
        "src/schema.ts":
          "import { z } from 'zod';\nexport const schema = z.object({ name: z.string() });",
      });
      const without = createMockContext({});
      const r1 = await docReadabilityAnalyzer.analyze(withZod);
      const r2 = await docReadabilityAnalyzer.analyze(without);
      expect(r1.score).toBeGreaterThan(r2.score);
    });
  });

  describe("score clamping", () => {
    it("never exceeds 100", async () => {
      const ctx = createMockContext({
        "openapi.yaml": "openapi: 3.0.0",
        "schema.graphql": "type Query { hello: String }",
        "src/trpc.router.ts": "export const router = {};",
        "error.codes.json": "{}",
        "package.json": JSON.stringify({
          dependencies: { zod: "^3.0.0" },
        }),
        "docs/adr-001.md": "# ADR 001",
        "CHANGELOG.md": "# Changelog",
        "types.ts": "export type Foo = string;",
        "README.md": "# Proj\n## A\n## B\n## C\n## D\n## E",
        "docs/runbook.yaml": "steps: []",
      });
      const result = await docReadabilityAnalyzer.analyze(ctx);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });
});

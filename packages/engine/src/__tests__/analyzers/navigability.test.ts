import { describe, it, expect } from "vitest";
import { navigabilityAnalyzer } from "../../analyzers/navigability.js";
import { createMockContext } from "../helpers.js";

describe("navigabilityAnalyzer (P7)", () => {
  it("always reports pillar P7 with weight 0.12", async () => {
    const ctx = createMockContext({ "src/app.ts": "export const x = 1;" });
    const result = await navigabilityAnalyzer.analyze(ctx);
    expect(result.pillar).toBe("P7");
    expect(result.weight).toBe(0.12);
  });

  it("always supports any repo", async () => {
    const ctx = createMockContext({});
    expect(await navigabilityAnalyzer.supports(ctx)).toBe(true);
  });

  describe("empty repo", () => {
    it("returns midpoint score with low confidence", async () => {
      const ctx = createMockContext({});
      const result = await navigabilityAnalyzer.analyze(ctx);
      expect(result.score).toBe(50);
      expect(result.confidence).toBe("low");
    });
  });

  describe("import analysis", () => {
    it("emits ARI-NAV-004 for files with >20 imports", async () => {
      const imports = Array.from(
        { length: 25 },
        (_, i) => `import { mod${i} } from './mod${i}';`,
      ).join("\n");
      const ctx = createMockContext({
        "src/heavy.ts": imports + "\nexport const x = 1;",
        "src/light.ts": "import { x } from './heavy';\nexport const y = x;",
      });
      const result = await navigabilityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-NAV-004")).toBe(true);
    });

    it("does not emit ARI-NAV-004 for files with <= 20 imports", async () => {
      const imports = Array.from(
        { length: 5 },
        (_, i) => `import { mod${i} } from './mod${i}';`,
      ).join("\n");
      const ctx = createMockContext({
        "src/normal.ts": imports + "\nexport const x = 1;",
      });
      const result = await navigabilityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-NAV-004")).toBe(false);
    });

    it("adds points when no files have heavy imports", async () => {
      const files: Record<string, string> = {};
      for (let i = 0; i < 5; i++) {
        files[`src/mod${i}.ts`] = `import { x } from './utils';\nexport const m${i} = x + ${i};`;
      }
      const ctx = createMockContext(files);
      const result = await navigabilityAnalyzer.analyze(ctx);
      // Should get the bonus for no heavy imports
      expect(result.score).toBeGreaterThanOrEqual(50);
    });
  });

  describe("circular dependency detection", () => {
    it("emits ARI-NAV-005 for mutual imports", async () => {
      const ctx = createMockContext({
        "src/a.ts": "import { b } from './b';\nexport const a = b + 1;",
        "src/b.ts": "import { a } from './a';\nexport const b = a + 1;",
      });
      const result = await navigabilityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-NAV-005")).toBe(true);
    });

    it("does not emit ARI-NAV-005 for one-directional imports", async () => {
      const ctx = createMockContext({
        "src/a.ts": "import { b } from './b';\nexport const a = b + 1;",
        "src/b.ts": "export const b = 42;",
      });
      const result = await navigabilityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-NAV-005")).toBe(false);
    });
  });

  describe("ARI-NAV-006: Dead code detection", () => {
    it("emits ARI-NAV-006 when multiple files are never imported", async () => {
      const files: Record<string, string> = {
        "src/index.ts": "export * from './used';",
        "src/used.ts": "export const used = 1;",
      };
      // Add several orphan files that are never imported
      for (let i = 0; i < 5; i++) {
        files[`src/orphan${i}.ts`] = `export const orphan${i} = ${i};`;
      }
      const ctx = createMockContext(files);
      const result = await navigabilityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-NAV-006")).toBe(true);
    });

    it("does not flag index/entry-point files as dead code", async () => {
      const ctx = createMockContext({
        "src/index.ts": "export const app = 1;",
        "src/main.ts": "export const main = 1;",
        "src/app.ts": "export const app = 1;",
      });
      const result = await navigabilityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-NAV-006")).toBe(false);
    });
  });

  describe("ARI-NAV-007: Cognitive complexity estimate", () => {
    it("emits ARI-NAV-007 for deeply nested code", async () => {
      const deeplyNested = [
        "export function complex() {",
        "  if (true) {",
        "    if (true) {",
        "      if (true) {",
        "        if (true) {",
        "          if (true) {",
        "            return 1;",
        "          }",
        "        }",
        "      }",
        "    }",
        "  }",
        "}",
      ].join("\n");
      const ctx = createMockContext({
        "src/complex.ts": deeplyNested,
      });
      const result = await navigabilityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-NAV-007")).toBe(true);
    });

    it("does not emit ARI-NAV-007 for simple flat code", async () => {
      const files: Record<string, string> = {};
      for (let i = 0; i < 5; i++) {
        files[`src/simple${i}.ts`] = `export function fn${i}() {\n  return ${i};\n}`;
      }
      const ctx = createMockContext(files);
      const result = await navigabilityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-NAV-007")).toBe(false);
    });
  });

  describe("summary includes top issues", () => {
    it("includes problem areas in summary when issues exist", async () => {
      const imports = Array.from({ length: 25 }, (_, i) =>
        `import { mod${i} } from './mod${i}';`,
      ).join("\n");
      const ctx = createMockContext({
        "src/heavy.ts": imports + "\nexport const x = 1;",
      });
      const result = await navigabilityAnalyzer.analyze(ctx);
      expect(result.summary).toContain("Top issues:");
    });

    it("shows no major issues when repo is clean", async () => {
      const ctx = createMockContext({
        "src/index.ts": "import { x } from './mod';\nexport { x };",
        "src/mod.ts": "export const x = 1;",
      });
      const result = await navigabilityAnalyzer.analyze(ctx);
      expect(result.summary).toContain("No major navigation issues");
    });
  });

  describe("score clamping", () => {
    it("never exceeds 100", async () => {
      const files: Record<string, string> = {};
      for (let i = 0; i < 10; i++) {
        files[`src/mod${i}.ts`] = `export const m${i} = ${i};`;
      }
      files["src/index.ts"] = "export * from './mod0';";
      files["packages/core/index.ts"] = "export const core = 1;";
      const ctx = createMockContext(files);
      const result = await navigabilityAnalyzer.analyze(ctx);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });
});

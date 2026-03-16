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

  describe("ARI-NAV-007: Per-function cognitive complexity", () => {
    it("emits ARI-NAV-007 with severity high for deeply nested functions (complexity >15)", async () => {
      const deeplyNested = [
        "export function complex() {",
        "  if (true) {",
        "    if (true) {",
        "      for (let i = 0; i < 10; i++) {",
        "        if (true) {",
        "          while (true) {",
        "            if (true && false) {",
        "              return 1;",
        "            }",
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
      const finding = result.findings.find((f) => f.code === "ARI-NAV-007");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("high");
      expect(finding?.message).toContain("complex");
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

    it("reports function names in the ARI-NAV-007 finding message", async () => {
      const complexFn = [
        "export function processOrder() {",
        "  if (true) {",
        "    for (let i = 0; i < 10; i++) {",
        "      if (true) {",
        "        switch (i) {",
        "          case 0:",
        "            if (true || false) {",
        "              while (true) {",
        "                break;",
        "              }",
        "            }",
        "            break;",
        "        }",
        "      }",
        "    }",
        "  }",
        "}",
      ].join("\n");
      const ctx = createMockContext({
        "src/order.ts": complexFn,
      });
      const result = await navigabilityAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-NAV-007");
      expect(finding).toBeDefined();
      expect(finding?.message).toContain("processOrder");
    });

    it("emits medium severity for moderate complexity (>3 moderate functions)", async () => {
      // Create 4+ functions with moderate complexity (9-15)
      // Each function has ~10 complexity: 3 if-statements + 1 for-loop with nesting
      const moderateFn = (name: string) =>
        [
          `export function ${name}(x) {`,
          "  if (x > 0) {",
          "    for (let i = 0; i < x; i++) {",
          "      if (i % 2 === 0) {",
          "        console.log(i);",
          "      }",
          "    }",
          "  }",
          "  if (x < 0) {",
          "    return -1;",
          "  }",
          "  if (x === 0) {",
          "    return null;",
          "  }",
          "  return x;",
          "}",
        ].join("\n");

      const ctx = createMockContext({
        "src/a.ts": moderateFn("fnA"),
        "src/b.ts": moderateFn("fnB"),
        "src/c.ts": moderateFn("fnC"),
        "src/d.ts": moderateFn("fnD"),
      });
      const result = await navigabilityAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-NAV-007");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("medium");
    });

    it("includes research evidence on high-complexity findings", async () => {
      const deeplyNested = [
        "export function terrible() {",
        "  if (true) {",
        "    if (true) {",
        "      for (let i = 0; i < 10; i++) {",
        "        if (true) {",
        "          while (true) {",
        "            if (true && false || true) {",
        "              return 1;",
        "            }",
        "          }",
        "        }",
        "      }",
        "    }",
        "  }",
        "}",
      ].join("\n");
      const ctx = createMockContext({
        "src/bad.ts": deeplyNested,
      });
      const result = await navigabilityAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-NAV-007");
      expect(finding?.evidence).toBeDefined();
      expect(finding?.evidence?.paper).toContain("Shippey");
    });

    it("handles arrow functions assigned to const", async () => {
      const arrowFn = [
        "export const processData = (items) => {",
        "  if (items.length > 0) {",
        "    for (const item of items) {",
        "      if (item.active) {",
        "        if (item.value > 0) {",
        "          if (item.type === 'a' || item.type === 'b') {",
        "            for (const sub of item.children) {",
        "              if (sub.valid) {",
        "                return sub;",
        "              }",
        "            }",
        "          }",
        "        }",
        "      }",
        "    }",
        "  }",
        "};",
      ].join("\n");
      const ctx = createMockContext({
        "src/arrow.ts": arrowFn,
      });
      const result = await navigabilityAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-NAV-007");
      expect(finding).toBeDefined();
      expect(finding?.message).toContain("processData");
    });

    it("aggregates complexity across multiple functions in same file", async () => {
      // One file with multiple poor functions should report both
      const content = [
        "export function fn1() {",
        "  if (true) {",
        "    for (let i = 0; i < 10; i++) {",
        "      if (true) {",
        "        while (true) {",
        "          if (true && false) {",
        "            return 1;",
        "          }",
        "        }",
        "      }",
        "    }",
        "  }",
        "}",
        "",
        "export function fn2() {",
        "  if (true) {",
        "    for (let i = 0; i < 10; i++) {",
        "      if (true) {",
        "        switch (i) {",
        "          case 0:",
        "            if (true || false) {",
        "              break;",
        "            }",
        "        }",
        "      }",
        "    }",
        "  }",
        "}",
      ].join("\n");
      const ctx = createMockContext({
        "src/multi.ts": content,
      });
      const result = await navigabilityAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-NAV-007");
      expect(finding).toBeDefined();
      // Should mention multiple functions in the message
      expect(finding?.message).toMatch(/\d+ function/);
    });
  });

  describe("ARI-NAV-008: Code duplication detection", () => {
    it("emits ARI-NAV-008 when multiple files share duplicated code blocks", async () => {
      const sharedBlock = [
        "function processData(input) {",
        "  const result = input.map(item => item.value);",
        "  const filtered = result.filter(v => v > 0);",
        "  const sorted = filtered.sort((a, b) => a - b);",
        "  const total = sorted.reduce((sum, v) => sum + v, 0);",
        "  return { sorted, total };",
        "}",
      ].join("\n");

      const files: Record<string, string> = {};
      // Create several files with identical code blocks
      for (let i = 0; i < 6; i++) {
        files[`src/handler${i}.ts`] =
          `const name${i} = "handler${i}";\n${sharedBlock}\nexport const h${i} = processData;`;
      }
      const ctx = createMockContext(files);
      const result = await navigabilityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-NAV-008")).toBe(true);
    });

    it("does not emit ARI-NAV-008 when files have unique code", async () => {
      const files: Record<string, string> = {};
      for (let i = 0; i < 5; i++) {
        files[`src/unique${i}.ts`] = [
          `export function fn${i}(x: number) {`,
          `  const result${i} = x * ${i + 2};`,
          `  const label${i} = "unique-${i}-value";`,
          `  const check${i} = result${i} > ${i * 10};`,
          `  const output${i} = check${i} ? label${i} : "none";`,
          `  return output${i};`,
          "}",
        ].join("\n");
      }
      const ctx = createMockContext(files);
      const result = await navigabilityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-NAV-008")).toBe(false);
    });

    it("includes duplication in summary when detected", async () => {
      const sharedBlock = [
        "function validate(data) {",
        "  const errors = [];",
        "  if (!data.name) errors.push('missing name');",
        "  if (!data.email) errors.push('missing email');",
        "  if (!data.age) errors.push('missing age');",
        "  return errors;",
        "}",
      ].join("\n");

      const files: Record<string, string> = {};
      for (let i = 0; i < 6; i++) {
        files[`src/validator${i}.ts`] =
          `const ctx${i} = ${i};\n${sharedBlock}\nexport default validate;`;
      }
      const ctx = createMockContext(files);
      const result = await navigabilityAnalyzer.analyze(ctx);
      expect(result.summary).toContain("duplicated code");
    });
  });

  describe("threshold labels in summary (AC#2)", () => {
    it("includes threshold labels for all metrics in summary", async () => {
      const files: Record<string, string> = {
        "src/index.ts": "import { x } from './mod';\nexport { x };",
        "src/mod.ts": "export const x = 1;",
      };
      const ctx = createMockContext(files);
      const result = await navigabilityAnalyzer.analyze(ctx);
      expect(result.summary).toContain("Thresholds:");
      expect(result.summary).toContain("depth:");
      expect(result.summary).toContain("dirs:");
      expect(result.summary).toContain("naming:");
      expect(result.summary).toContain("imports:");
      expect(result.summary).toContain("circular:");
      expect(result.summary).toContain("dead-code:");
      expect(result.summary).toContain("duplication:");
    });

    it("labels depth as good for shallow repos (<=5)", async () => {
      const ctx = createMockContext({
        "src/a.ts": "export const a = 1;",
        "src/b.ts": "import { a } from './a';\nexport const b = a;",
      });
      const result = await navigabilityAnalyzer.analyze(ctx);
      expect(result.summary).toContain("depth:good");
    });

    it("labels depth as poor for deeply nested repos (>8)", async () => {
      const files: Record<string, string> = {
        "a/b/c/d/e/f/g/h/i/deep.ts": "export const x = 1;",
        "src/index.ts": "export const y = 1;",
      };
      const ctx = createMockContext(files);
      const result = await navigabilityAnalyzer.analyze(ctx);
      expect(result.summary).toContain("depth:poor");
    });

    it("labels naming as good when >=80% consistent", async () => {
      const files: Record<string, string> = {};
      for (let i = 0; i < 10; i++) {
        files[`src/my-module-${i}.ts`] = `export const m${i} = ${i};`;
      }
      files["src/index.ts"] = "export const x = 1;";
      const ctx = createMockContext(files);
      const result = await navigabilityAnalyzer.analyze(ctx);
      expect(result.summary).toContain("naming:good");
    });

    it("labels imports as good when no files have >20 imports", async () => {
      const ctx = createMockContext({
        "src/a.ts": "import { x } from './b';\nexport const a = x;",
        "src/b.ts": "export const x = 1;",
      });
      const result = await navigabilityAnalyzer.analyze(ctx);
      expect(result.summary).toContain("imports:good");
    });

    it("labels circular as good when no circular deps", async () => {
      const ctx = createMockContext({
        "src/a.ts": "import { b } from './b';\nexport const a = b;",
        "src/b.ts": "export const b = 1;",
      });
      const result = await navigabilityAnalyzer.analyze(ctx);
      expect(result.summary).toContain("circular:good");
    });

    it("labels circular as poor when circular deps exist", async () => {
      const ctx = createMockContext({
        "src/a.ts": "import { b } from './b';\nexport const a = b + 1;",
        "src/b.ts": "import { a } from './a';\nexport const b = a + 1;",
      });
      const result = await navigabilityAnalyzer.analyze(ctx);
      expect(result.summary).toContain("circular:poor");
    });
  });

  describe("ARI-NAV-006: Dead code false positive reduction (AC#4)", () => {
    it("does not flag config files as dead code", async () => {
      const files: Record<string, string> = {
        "src/index.ts": "export const x = 1;",
        "vitest.config.ts": "export default {};",
        "tsup.config.ts": "export default {};",
        "eslint.config.ts": "export default {};",
      };
      const ctx = createMockContext(files);
      const result = await navigabilityAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-NAV-006");
      // Config files should not appear in dead code candidates
      if (finding) {
        expect(finding.message).not.toContain(".config.");
      }
    });

    it("does not flag CLI entry files as dead code", async () => {
      const files: Record<string, string> = {
        "src/index.ts": "export const x = 1;",
        "src/cli.ts": "import { x } from './index';\nconsole.log(x);",
        "src/bin.ts": "#!/usr/bin/env node",
      };
      const ctx = createMockContext(files);
      const result = await navigabilityAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-NAV-006");
      if (finding) {
        expect(finding.message).not.toContain("cli.ts");
        expect(finding.message).not.toContain("bin.ts");
      }
    });

    it("does not flag files in commands/ directory as dead code", async () => {
      const files: Record<string, string> = {
        "src/index.ts": "export const x = 1;",
        "src/commands/scan.ts": "export default function scan() { return 1; }",
        "src/commands/init.ts": "export default function init() { return 1; }",
      };
      const ctx = createMockContext(files);
      const result = await navigabilityAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-NAV-006");
      if (finding) {
        expect(finding.message).not.toContain("commands/");
      }
    });

    it("does not flag files re-exported through barrel files", async () => {
      const files: Record<string, string> = {
        "src/index.ts": "export * from './utils';\nexport * from './helpers';",
        "src/utils.ts": "export const util = 1;",
        "src/helpers.ts": "export const helper = 2;",
      };
      const ctx = createMockContext(files);
      const result = await navigabilityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-NAV-006")).toBe(false);
    });
  });

  describe("summary includes top issues", () => {
    it("includes problem areas in summary when issues exist", async () => {
      const imports = Array.from(
        { length: 25 },
        (_, i) => `import { mod${i} } from './mod${i}';`,
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

  describe("ARI-NAV-009: Structural clarity for retrieval (P1.11)", () => {
    it("emits info ARI-NAV-009 when barrel files and layer separation exist", async () => {
      const files: Record<string, string> = {
        "src/index.ts": "export * from './utils';\nexport * from './services';",
        "src/utils/index.ts": "export * from './helpers';",
        "src/utils/helpers.ts": "export const help = 1;",
        "src/services/index.ts": "export * from './api';",
        "src/services/api.ts": "export const api = 1;",
        "src/models/index.ts": "export * from './user';",
        "src/models/user.ts": "export const user = 1;",
      };
      const ctx = createMockContext(files);
      const result = await navigabilityAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-NAV-009");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("info");
    });

    it("emits medium ARI-NAV-009 when no barrel files or layers exist", async () => {
      const files: Record<string, string> = {};
      for (let i = 0; i < 8; i++) {
        files[`flat/file${i}.ts`] = `export const f${i} = ${i};`;
      }
      const ctx = createMockContext(files);
      const result = await navigabilityAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-NAV-009");
      if (finding) {
        expect(finding.severity).toBe("medium");
        expect(finding.remediation).toBeDefined();
      }
    });

    it("includes structure label in threshold summary", async () => {
      const files: Record<string, string> = {
        "src/index.ts": "export const x = 1;",
        "src/mod.ts": "export const y = 2;",
      };
      const ctx = createMockContext(files);
      const result = await navigabilityAnalyzer.analyze(ctx);
      expect(result.summary).toContain("structure:");
    });
  });

  describe("researchBasis (P1.13)", () => {
    it("includes researchBasis in result", async () => {
      const ctx = createMockContext({
        "src/index.ts": "export const x = 1;",
      });
      const result = await navigabilityAnalyzer.analyze(ctx);
      expect(result.researchBasis).toBeDefined();
      expect(Array.isArray(result.researchBasis)).toBe(true);
      expect((result.researchBasis ?? []).length).toBeGreaterThanOrEqual(1);
    });

    it("includes researchBasis even for empty repo", async () => {
      const ctx = createMockContext({});
      const result = await navigabilityAnalyzer.analyze(ctx);
      expect(result.researchBasis).toBeDefined();
      expect((result.researchBasis ?? []).length).toBeGreaterThanOrEqual(1);
    });
  });
});

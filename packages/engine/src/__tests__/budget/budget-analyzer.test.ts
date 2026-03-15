import { describe, it, expect } from "vitest";
import { analyzeTokenBudget, formatTokenCount } from "../../budget/budget-analyzer.js";
import { createMockContext } from "../helpers.js";

describe("analyzeTokenBudget", () => {
  it("produces a result with correct totals", async () => {
    const ctx = createMockContext({
      "src/index.ts": "const x = 1;\n".repeat(100), // ~1300 bytes of source
      "README.md": "# Hello\n\nThis is documentation.\n".repeat(50), // ~1550 bytes of docs
    });

    const result = await analyzeTokenBudget(ctx);

    expect(result.totalFiles).toBe(2);
    expect(result.totalBytes).toBeGreaterThan(0);
    expect(result.totalTokens).toBeGreaterThan(0);
    expect(result.byCategory.length).toBeGreaterThan(0);
  });

  it("categorizes files correctly in the budget", async () => {
    const ctx = createMockContext({
      "src/app.ts": "export function main() { return 42; }",
      "src/app.test.ts": "it('works', () => expect(1).toBe(1));",
      "README.md": "# Documentation",
      "tsconfig.json": '{ "compilerOptions": {} }',
      "package-lock.json": '{ "lockfileVersion": 3 }',
    });

    const result = await analyzeTokenBudget(ctx);

    const categories = new Map(result.byCategory.map((c) => [c.category, c]));
    expect(categories.get("source")?.fileCount).toBe(1);
    expect(categories.get("test")?.fileCount).toBe(1);
    expect(categories.get("docs")?.fileCount).toBe(1);
    expect(categories.get("config")?.fileCount).toBe(1);
    expect(categories.get("lockfile")?.fileCount).toBe(1);
  });

  it("percentages sum to approximately 100", async () => {
    const ctx = createMockContext({
      "src/a.ts": "const a = 1;",
      "src/b.ts": "const b = 2;",
      "README.md": "# Hello",
    });

    const result = await analyzeTokenBudget(ctx);
    const total = result.byCategory.reduce((sum, c) => sum + c.percentage, 0);
    expect(total).toBeGreaterThanOrEqual(99);
    expect(total).toBeLessThanOrEqual(101);
  });

  it("identifies hotspots sorted by token count", async () => {
    const ctx = createMockContext({
      "src/small.ts": "x",
      "src/medium.ts": "y".repeat(1000),
      "src/large.ts": "z".repeat(10000),
    });

    const result = await analyzeTokenBudget(ctx);
    expect(result.hotspots.length).toBeGreaterThan(0);
    expect(result.hotspots[0]?.path).toBe("src/large.ts");
  });

  it("recommends adding lockfiles to .agentignore", async () => {
    const ctx = createMockContext({
      "src/app.ts": "const x = 1;",
      "package-lock.json": JSON.stringify({ lockfileVersion: 3, packages: {} }).repeat(100),
    });

    const result = await analyzeTokenBudget(ctx);
    const lockfileRec = result.recommendations.find((r) => r.description.includes("lockfile"));
    expect(lockfileRec).toBeDefined();
    expect(lockfileRec?.targetFiles).toContain("package-lock.json");
    expect(lockfileRec?.estimatedSavingsTokens).toBeGreaterThan(0);
  });

  it("recommends adding generated files to .agentignore", async () => {
    const ctx = createMockContext({
      "src/app.ts": "const x = 1;",
      "dist/index.d.ts": "declare const x: number;\n".repeat(200),
      "dist/index.js.map": '{"version":3}'.repeat(200),
    });

    const result = await analyzeTokenBudget(ctx);
    const generatedRec = result.recommendations.find((r) => r.description.includes("generated"));
    expect(generatedRec).toBeDefined();
    expect(generatedRec?.targetFiles.length).toBeGreaterThan(0);
  });

  it("excludes binary files from token counting", async () => {
    const ctx = createMockContext({
      "src/app.ts": "const x = 1;",
      "logo.png": "binary-content-here",
    });

    const result = await analyzeTokenBudget(ctx);
    const binaryFile = result.hotspots.find((h) => h.path === "logo.png");
    // Binary should either not appear or have 0 tokens
    if (binaryFile) {
      expect(binaryFile.estimatedTokens).toBe(0);
    }
  });

  it("handles empty repo gracefully", async () => {
    const ctx = createMockContext({});
    const result = await analyzeTokenBudget(ctx);

    expect(result.totalFiles).toBe(0);
    expect(result.totalTokens).toBe(0);
    expect(result.byCategory).toEqual([]);
    expect(result.hotspots).toEqual([]);
    expect(result.recommendations).toEqual([]);
  });

  it("recommends splitting oversized docs", async () => {
    const ctx = createMockContext({
      "docs/huge-guide.md": "This is documentation content.\n".repeat(2000), // ~62k bytes → ~15k tokens
    });

    const result = await analyzeTokenBudget(ctx);
    const docRec = result.recommendations.find((r) =>
      r.description.includes("oversized documentation"),
    );
    expect(docRec).toBeDefined();
  });

  it("is stable across repeated runs", async () => {
    const ctx = createMockContext({
      "src/a.ts": "const a = 1;".repeat(50),
      "src/b.ts": "const b = 2;".repeat(50),
      "README.md": "# Docs\n".repeat(50),
      "pnpm-lock.yaml": "lockfileVersion: '9.0'\n".repeat(500),
    });

    const result1 = await analyzeTokenBudget(ctx);
    const result2 = await analyzeTokenBudget(ctx);

    expect(result1.totalTokens).toBe(result2.totalTokens);
    expect(result1.totalBytes).toBe(result2.totalBytes);
    expect(result1.byCategory).toEqual(result2.byCategory);
  });
});

describe("formatTokenCount", () => {
  it("formats small numbers as-is", () => {
    expect(formatTokenCount(500)).toBe("500");
    expect(formatTokenCount(0)).toBe("0");
  });

  it("formats thousands as k", () => {
    expect(formatTokenCount(1500)).toBe("1.5k");
    expect(formatTokenCount(10000)).toBe("10.0k");
  });

  it("formats millions as M", () => {
    expect(formatTokenCount(1500000)).toBe("1.5M");
    expect(formatTokenCount(2000000)).toBe("2.0M");
  });
});

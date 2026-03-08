import { describe, it, expect } from "vitest";
import { contextQualityAnalyzer } from "../../analyzers/context-quality.js";
import { createMockContext } from "../helpers.js";

describe("contextQualityAnalyzer (P1)", () => {
  it("always reports pillar P1 with weight 0.15", async () => {
    const ctx = createMockContext({});
    const result = await contextQualityAnalyzer.analyze(ctx);
    expect(result.pillar).toBe("P1");
    expect(result.weight).toBe(0.15);
  });

  it("always supports any repo", async () => {
    const ctx = createMockContext({});
    expect(await contextQualityAnalyzer.supports(ctx)).toBe(true);
  });

  describe("empty repo", () => {
    it("returns baseline score of 20", async () => {
      const ctx = createMockContext({});
      const result = await contextQualityAnalyzer.analyze(ctx);
      expect(result.score).toBe(20);
    });

    it("emits ARI-CTX-001 finding for missing context files", async () => {
      const ctx = createMockContext({});
      const result = await contextQualityAnalyzer.analyze(ctx);
      const codes = result.findings.map((f) => f.code);
      expect(codes).toContain("ARI-CTX-001");
    });

    it("emits ARI-CTX-004 finding for missing README", async () => {
      const ctx = createMockContext({});
      const result = await contextQualityAnalyzer.analyze(ctx);
      const codes = result.findings.map((f) => f.code);
      expect(codes).toContain("ARI-CTX-004");
    });
  });

  describe("repo with README only", () => {
    it("scores higher than baseline (20) due to README", async () => {
      const readme = Array.from({ length: 25 }, (_, i) => `Line ${i + 1}`).join("\n");
      const ctx = createMockContext({ "README.md": readme });
      const result = await contextQualityAnalyzer.analyze(ctx);
      // Baseline 20 + 5 for README > 20 lines = 25
      expect(result.score).toBeGreaterThan(20);
    });

    it("still emits ARI-CTX-001 (no context files)", async () => {
      const ctx = createMockContext({ "README.md": "# Hello\nSome content" });
      const result = await contextQualityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-CTX-001")).toBe(true);
    });
  });

  describe("repo with short AGENTS.md (< 10 lines)", () => {
    it("scores above baseline", async () => {
      const ctx = createMockContext({
        "AGENTS.md": "# Agent Context\nSome short instructions.",
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      // Baseline 20 + 15 (one context file) = 35, but short so no +10
      expect(result.score).toBeGreaterThan(20);
    });

    it("emits ARI-CTX-002 for short AGENTS.md", async () => {
      const ctx = createMockContext({
        "AGENTS.md": "# Agent Context\nShort.",
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-CTX-002")).toBe(true);
    });

    it("emits ARI-CTX-003 when .agentignore is missing", async () => {
      const ctx = createMockContext({
        "AGENTS.md": "# Agent Context\nShort.",
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-CTX-003")).toBe(true);
    });
  });

  describe("repo with detailed AGENTS.md", () => {
    const detailedAgentsMd = [
      "# AGENTS.md",
      "",
      "## Architecture",
      "This project uses a monorepo layout with packages.",
      "",
      "## Conventions",
      "- Use kebab-case for file names",
      "- Never use `any` in TypeScript",
      "",
      "## Don't do this",
      "Don't import from internal modules directly.",
      "",
      "```typescript",
      "// good",
      "import { foo } from '@pkg/foo';",
      "```",
      "",
      "## Testing",
      "Run tests with `pnpm test`.",
    ].join("\n");

    it("scores high with headings, code blocks, and don't statements", async () => {
      const ctx = createMockContext({ "AGENTS.md": detailedAgentsMd });
      const result = await contextQualityAnalyzer.analyze(ctx);
      // 20 base + 15 (one context file) + 10 (>= 10 lines) + 5 (headings) + 5 (code blocks) + 5 (don't) = 60
      expect(result.score).toBeGreaterThanOrEqual(60);
    });

    it("does not emit ARI-CTX-002", async () => {
      const ctx = createMockContext({ "AGENTS.md": detailedAgentsMd });
      const result = await contextQualityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-CTX-002")).toBe(false);
    });
  });

  describe("repo with AGENTS.md + CLAUDE.md + .agentignore", () => {
    const agentsMd = [
      "# AGENTS.md",
      "## Architecture",
      "Monorepo with packages.",
      "## Conventions",
      "Use strict TypeScript.",
      "## Don'ts",
      "Never skip tests.",
      "```ts",
      "// example",
      "```",
      "More lines to pass the 10-line threshold.",
      "And more.",
    ].join("\n");

    it("approaches maximum score", async () => {
      const ctx = createMockContext({
        "AGENTS.md": agentsMd,
        "CLAUDE.md": "# Claude-specific instructions\nUse concise answers.",
        ".agentignore": "node_modules/\ndist/\n",
        "README.md": Array.from({ length: 25 }, (_, i) => `Line ${i}`).join("\n"),
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      // 20 base + 15*3 (3 context files, capped at 3) + 10 (>=10 lines) + 5 (headings) + 5 (code) + 5 (don't)
      // + 10 (.agentignore) + 5 (README >20 lines) = 105, capped at 100
      expect(result.score).toBeGreaterThanOrEqual(80);
    });

    it("does not emit ARI-CTX-001", async () => {
      const ctx = createMockContext({
        "AGENTS.md": agentsMd,
        "CLAUDE.md": "# Claude\nContext.",
        ".agentignore": "dist/\n",
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-CTX-001")).toBe(false);
    });

    it("does not emit ARI-CTX-003 when .agentignore is present", async () => {
      const ctx = createMockContext({
        "AGENTS.md": agentsMd,
        ".agentignore": "dist/\n",
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-CTX-003")).toBe(false);
    });
  });

  describe("score clamping", () => {
    it("never exceeds 100", async () => {
      const agentsMd = Array.from({ length: 20 }, (_, i) => {
        if (i === 0) return "# AGENTS.md";
        if (i === 1) return "## Section";
        if (i === 2) return "```ts\ncode\n```";
        if (i === 3) return "Don't do bad things.";
        return `Line ${i}`;
      }).join("\n");

      const ctx = createMockContext({
        "AGENTS.md": agentsMd,
        "CLAUDE.md": "# Claude",
        ".cursorrules": "rules",
        ".agentignore": "dist/",
        "README.md": Array.from({ length: 30 }, (_, i) => `Line ${i}`).join("\n"),
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it("never goes below 0", async () => {
      const ctx = createMockContext({});
      const result = await contextQualityAnalyzer.analyze(ctx);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });
});

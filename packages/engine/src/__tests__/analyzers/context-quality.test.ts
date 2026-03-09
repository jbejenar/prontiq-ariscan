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

  describe("additional context file discovery", () => {
    it("discovers .mcp.json", async () => {
      const ctx = createMockContext({
        ".mcp.json": '{"servers":{}}',
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      expect(result.summary).toContain(".mcp.json");
      expect(result.findings.some((f) => f.code === "ARI-CTX-001")).toBe(false);
    });

    it("discovers mcp.config.js", async () => {
      const ctx = createMockContext({
        "mcp.config.js": "export default {};",
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      expect(result.summary).toContain("mcp.config.js");
    });

    it("discovers .claude/settings.json", async () => {
      const ctx = createMockContext({
        ".claude/settings.json": '{"key":"value"}',
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      expect(result.summary).toContain(".claude/settings.json");
    });

    it("discovers .claude/commands/ directory", async () => {
      const ctx = createMockContext({
        ".claude/commands/review.md": "# Review command",
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      expect(result.summary).toContain(".claude/commands/");
    });
  });

  describe("nested AGENTS.md discovery (monorepo)", () => {
    it("discovers nested AGENTS.md files", async () => {
      const ctx = createMockContext({
        "AGENTS.md":
          "# Root agents\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8\nLine 9\nLine 10\nLine 11",
        "packages/foo/AGENTS.md": "# Foo agents\nSpecific to foo package.",
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      expect(result.summary).toContain("packages/foo/AGENTS.md");
    });

    it("counts nested AGENTS.md toward context file total", async () => {
      const ctx = createMockContext({
        "packages/bar/AGENTS.md": "# Bar agents\nBar specific.",
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      // Should not emit ARI-CTX-001 since we found a context file
      expect(result.findings.some((f) => f.code === "ARI-CTX-001")).toBe(false);
    });
  });

  describe("file metadata in summary", () => {
    it("includes line count and size in summary", async () => {
      const content = "# AGENTS.md\nLine 2\nLine 3";
      const ctx = createMockContext({ "AGENTS.md": content });
      const result = await contextQualityAnalyzer.analyze(ctx);
      expect(result.summary).toContain("3 lines");
      expect(result.summary).toContain("bytes");
    });

    it("shows directory label for directory patterns", async () => {
      const ctx = createMockContext({
        ".claude/commands/test.md": "# Test",
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      expect(result.summary).toContain("directory");
    });
  });

  describe("front-loading analysis (ARI-CTX-005)", () => {
    it("emits ARI-CTX-005 when build commands are buried in AGENTS.md", async () => {
      // Create a file where critical info is only in the bottom 80%
      const topLines = Array.from({ length: 40 }, (_, i) => `General description line ${i}`);
      topLines[0] = "# AGENTS.md";
      const bottomLines = [
        "## Build",
        "```bash",
        "pnpm install",
        "pnpm build",
        "pnpm test",
        "```",
        "## Architecture overview",
        "This is the architecture.",
        "More lines.",
        "Even more.",
      ];
      const content = [...topLines, ...bottomLines].join("\n");
      const ctx = createMockContext({ "AGENTS.md": content });
      const result = await contextQualityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-CTX-005")).toBe(true);
    });

    it("does not emit ARI-CTX-005 when build commands are front-loaded", async () => {
      const content = [
        "# AGENTS.md",
        "## Build",
        "```bash",
        "pnpm install",
        "pnpm build",
        "```",
        "## Architecture overview",
        "The project structure.",
        "More content.",
        "And more.",
        "Line 11",
        "Line 12",
      ].join("\n");
      const ctx = createMockContext({ "AGENTS.md": content });
      const result = await contextQualityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-CTX-005")).toBe(false);
    });

    it("emits ARI-CTX-005 for CLAUDE.md with buried critical info", async () => {
      const topLines = Array.from({ length: 40 }, (_, i) => `General line ${i}`);
      topLines[0] = "# CLAUDE.md";
      const bottomLines = [
        "## Build",
        "```bash",
        "npm run build",
        "npm test",
        "```",
        "More lines.",
        "Even more.",
      ];
      const content = [...topLines, ...bottomLines].join("\n");
      const ctx = createMockContext({
        "AGENTS.md": "# Agents\nShort.",
        "CLAUDE.md": content,
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      const claude005 = result.findings.filter(
        (f) => f.code === "ARI-CTX-005" && f.message.includes("CLAUDE.md"),
      );
      expect(claude005.length).toBeGreaterThan(0);
    });

    it("does not emit ARI-CTX-005 for short files (< 10 lines)", async () => {
      const content = ["# AGENTS.md", "Short file.", "```bash", "pnpm test", "```"].join("\n");
      const ctx = createMockContext({ "AGENTS.md": content });
      const result = await contextQualityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-CTX-005")).toBe(false);
    });
  });

  describe("staleness detection (ARI-CTX-006)", () => {
    it("emits ARI-CTX-006 when AGENTS.md references non-existent paths", async () => {
      const content = [
        "# AGENTS.md",
        "## Architecture",
        "The main source is in src/components/",
        "Config is at config/settings.json",
        "Never modify old/legacy/code.ts",
        "Line 6",
        "Line 7",
        "Line 8",
        "Line 9",
        "Line 10",
        "Line 11",
      ].join("\n");
      const ctx = createMockContext({
        "AGENTS.md": content,
        "src/index.ts": "export {};",
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-CTX-006")).toBe(true);
    });

    it("does not emit ARI-CTX-006 when all referenced paths exist", async () => {
      const content = [
        "# AGENTS.md",
        "## Architecture",
        "The main source is in src/components/",
        "Tests are in src/tests/",
        "Line 5",
        "Line 6",
        "Line 7",
        "Line 8",
        "Line 9",
        "Line 10",
        "Line 11",
      ].join("\n");
      const ctx = createMockContext({
        "AGENTS.md": content,
        "src/components/App.tsx": "export {};",
        "src/tests/app.test.ts": "test('works', () => {});",
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-CTX-006")).toBe(false);
    });
  });

  describe("boilerplate detection (ARI-CTX-007)", () => {
    it("emits ARI-CTX-007 for generic auto-generated content", async () => {
      const content = [
        "# AGENTS.md",
        "",
        "This project is a web application.",
        "",
        "## Getting Started",
        "Follow the instructions below.",
        "",
        "## Contributing",
        "Please read our guidelines.",
        "",
        "Generated by create-project-tool.",
        "Line 12",
      ].join("\n");
      const ctx = createMockContext({
        "AGENTS.md": content,
        "src/index.ts": "export {};",
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-CTX-007")).toBe(true);
    });

    it("does not emit ARI-CTX-007 for project-specific content", async () => {
      const content = [
        "# AGENTS.md",
        "",
        "## Architecture",
        "This monorepo uses src/components for React components.",
        "The analyzer engine lives in src/engine with tests in src/tests.",
        "",
        "## Build",
        "```bash",
        "pnpm install",
        "pnpm build",
        "```",
        "Don't skip tests.",
      ].join("\n");
      const ctx = createMockContext({
        "AGENTS.md": content,
        "src/components/App.tsx": "<div/>",
        "src/engine/run.ts": "run();",
        "src/tests/run.test.ts": "test('ok', () => {});",
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-CTX-007")).toBe(false);
    });
  });

  describe("non-parsable file warnings (ARI-CTX-009)", () => {
    it("emits ARI-CTX-009 for invalid JSON context files", async () => {
      const ctx = createMockContext({
        ".claude/settings.json": "{ invalid json content",
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-CTX-009")).toBe(true);
      const finding = result.findings.find((f) => f.code === "ARI-CTX-009");
      expect(finding?.message).toContain("invalid JSON");
    });

    it("emits ARI-CTX-009 for empty context files", async () => {
      const ctx = createMockContext({
        "AGENTS.md": "   ",
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-CTX-009")).toBe(true);
      const finding = result.findings.find((f) => f.code === "ARI-CTX-009");
      expect(finding?.message).toContain("empty file");
    });

    it("emits ARI-CTX-009 for empty YAML context files", async () => {
      const ctx = createMockContext({
        ".aider.conf.yml": "   ",
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-CTX-009")).toBe(true);
      const finding = result.findings.find((f) => f.code === "ARI-CTX-009");
      expect(finding?.message).toContain("empty YAML");
    });

    it("does not emit ARI-CTX-009 for valid JSON context files", async () => {
      const ctx = createMockContext({
        ".claude/settings.json": '{"key": "value"}',
        ".mcp.json": '{"servers": {}}',
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-CTX-009")).toBe(false);
    });

    it("does not emit ARI-CTX-009 for valid markdown context files", async () => {
      const ctx = createMockContext({
        "AGENTS.md": "# Valid\nContent here.",
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-CTX-009")).toBe(false);
    });

    it("reduces score for each non-parsable file", async () => {
      const ctxValid = createMockContext({
        ".claude/settings.json": '{"key": "value"}',
      });
      const resultValid = await contextQualityAnalyzer.analyze(ctxValid);

      const ctxInvalid = createMockContext({
        ".claude/settings.json": "{ broken json",
      });
      const resultInvalid = await contextQualityAnalyzer.analyze(ctxInvalid);

      expect(resultInvalid.score).toBeLessThan(resultValid.score);
    });
  });

  describe("conciseness check (ARI-CTX-008)", () => {
    it("emits ARI-CTX-008 for very long AGENTS.md without proportional code blocks", async () => {
      // 600 lines of prose, only 1 code block
      const lines = ["# AGENTS.md", "```ts", "code", "```"];
      for (let i = 4; i <= 600; i++) {
        lines.push(`This is a long descriptive line number ${i} with lots of text.`);
      }
      const content = lines.join("\n");
      const ctx = createMockContext({ "AGENTS.md": content });
      const result = await contextQualityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-CTX-008")).toBe(true);
    });

    it("does not emit ARI-CTX-008 for long AGENTS.md with many code blocks", async () => {
      // 600 lines but lots of code blocks
      const lines = ["# AGENTS.md"];
      for (let i = 1; i <= 60; i++) {
        lines.push(`## Section ${i}`);
        lines.push("Description.");
        lines.push("```ts");
        lines.push(`const x${i} = ${i};`);
        lines.push("```");
        // Pad to ~10 lines per section
        for (let j = 0; j < 5; j++) {
          lines.push(`More details for section ${i}.`);
        }
      }
      const content = lines.join("\n");
      const ctx = createMockContext({ "AGENTS.md": content });
      const result = await contextQualityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-CTX-008")).toBe(false);
    });

    it("does not emit ARI-CTX-008 for short AGENTS.md", async () => {
      const content = [
        "# AGENTS.md",
        "## Architecture",
        "Simple project.",
        "Line 4",
        "Line 5",
        "Line 6",
        "Line 7",
        "Line 8",
        "Line 9",
        "Line 10",
        "Line 11",
      ].join("\n");
      const ctx = createMockContext({ "AGENTS.md": content });
      const result = await contextQualityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-CTX-008")).toBe(false);
    });
  });
});

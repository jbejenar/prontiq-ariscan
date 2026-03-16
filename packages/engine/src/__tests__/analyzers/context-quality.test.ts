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

    it("emits ARI-CTX-006 for single-directory references like src/ that do not exist", async () => {
      const content = [
        "# AGENTS.md",
        "## Architecture",
        "Source code lives in src/",
        "Tests are in tests/",
        "Also check ./lib/",
        "Line 6",
        "Line 7",
        "Line 8",
        "Line 9",
        "Line 10",
        "Line 11",
      ].join("\n");
      const ctx = createMockContext({
        "AGENTS.md": content,
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-CTX-006")).toBe(true);
    });

    it("does not emit ARI-CTX-006 for single-directory references that exist", async () => {
      const content = [
        "# AGENTS.md",
        "## Architecture",
        "Source code lives in src/",
        "Also check ./lib/",
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
        "src/index.ts": "export {};",
        "lib/utils.ts": "export {};",
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

  describe("cross-agent compatibility report (ARI-CTX-010)", () => {
    it("emits ARI-CTX-010 with 0 covered when no context files exist", async () => {
      const ctx = createMockContext({});
      const result = await contextQualityAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-CTX-010");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("medium");
      expect(finding?.message).toContain("0/5 agents covered");
    });

    it("reports covered and uncovered agents when some context files exist", async () => {
      const ctx = createMockContext({
        "AGENTS.md":
          "# Agents\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8\nLine 9\nLine 10\nLine 11",
        "CLAUDE.md": "# Claude\nInstructions.",
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-CTX-010");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("info");
      expect(finding?.message).toContain("2/5 agents covered");
      expect(finding?.message).toContain("Missing:");
      expect(finding?.message).toContain("Cursor");
    });

    it("counts .claude/commands/ directory toward Claude Code coverage", async () => {
      const ctx = createMockContext({
        ".claude/commands/review.md": "# Review command",
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-CTX-010");
      expect(finding).toBeDefined();
      expect(finding?.message).toContain("1/5 agents covered");
    });

    it("reports all agents covered when all context files present", async () => {
      const ctx = createMockContext({
        "AGENTS.md":
          "# Agents\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8\nLine 9\nLine 10\nLine 11",
        ".agentignore": "dist/",
        "CLAUDE.md": "# Claude\nInstructions.",
        ".cursorrules": "rules",
        ".github/copilot-instructions.md": "# Copilot",
        ".aider.conf.yml": "model: gpt-4",
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-CTX-010");
      // All 5 agents covered — no ARI-CTX-010 emitted
      expect(finding).toBeUndefined();
    });

    it("recognizes Aider coverage via .aiderignore", async () => {
      const ctx = createMockContext({
        "AGENTS.md":
          "# Agents\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8\nLine 9\nLine 10\nLine 11",
        ".agentignore": "dist/",
        ".aiderignore": "node_modules/",
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-CTX-010");
      expect(finding).toBeDefined();
      // Generic + Aider covered = 2, still missing Claude Code, Cursor, Copilot
      expect(finding?.message).toContain("2/5 agents covered");
    });
  });

  describe("additionality analysis (ARI-CTX-011)", () => {
    it("emits ARI-CTX-011 when AGENTS.md duplicates README content", async () => {
      const sharedContent = [
        "This project uses a monorepo layout managed by Turborepo with pnpm workspaces",
        "The main packages are located in the packages directory with schema engine and cli",
        "You can install dependencies by running pnpm install in the root directory",
        "Build all packages with pnpm build which uses turborepo for orchestration",
        "Run all tests with pnpm test which uses vitest as the testing framework",
        "Linting is done with eslint nine flat config and prettier for formatting",
        "TypeScript strict mode is enabled across all packages in the monorepo",
        "The project follows ESM only conventions with explicit js extensions in imports",
        "Never use the any type use unknown with type narrowing instead",
        "All code changes must pass typecheck lint and test before merging",
      ];
      const readme = [
        "# My Project",
        "",
        ...sharedContent.map((s) => s + "."),
        "",
        "## License",
        "MIT",
      ].join("\n");
      const agentsMd = [
        "# AGENTS.md",
        "",
        ...sharedContent.map((s) => s + "."),
        "",
        "## Extra",
        "Some unique content here.",
      ].join("\n");

      const ctx = createMockContext({
        "README.md": readme,
        "AGENTS.md": agentsMd,
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-CTX-011");
      expect(finding).toBeDefined();
      expect(finding?.message).toContain("redundancy");
      expect(finding?.message).toMatch(/\d+\.\d%/); // one decimal place
    });

    it("does not emit ARI-CTX-011 for AGENTS.md with unique content", async () => {
      const readme = [
        "# My Project",
        "A web application for managing tasks and projects efficiently.",
        "Built with React and Node.js for modern web development.",
        "## Installation",
        "Clone the repository and run npm install to get started.",
        "## License",
        "MIT Licensed open source software.",
      ].join("\n");
      const agentsMd = [
        "# AGENTS.md",
        "",
        "## Architecture Decisions",
        "The analyzer engine uses a provider pattern for dependency injection throughout.",
        "Each pillar has exactly one analyzer file implementing the PillarAnalyzer interface.",
        "",
        "## Conventions",
        "Finding codes follow the pattern ARI-PILLAR-NNN and must never be renumbered.",
        "Score clamping to zero through one hundred is mandatory in every analyzer.",
        "",
        "## Common Pitfalls",
        "Forgetting the js extension in relative imports causes runtime ESM resolution failures.",
        "Building schema before testing engine is required because of cross-package dependencies.",
      ].join("\n");

      const ctx = createMockContext({
        "README.md": readme,
        "AGENTS.md": agentsMd,
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-CTX-011")).toBe(false);
    });

    it("includes redundancy percentage to one decimal place", async () => {
      const readme = [
        "# Project",
        "This application processes data using advanced algorithms for analysis.",
        "The core engine transforms input into structured output formats.",
        "Testing is done with comprehensive integration and unit test suites.",
      ].join("\n");
      const agentsMd = [
        "# AGENTS.md",
        "This application processes data using advanced algorithms for analysis.",
        "The core engine transforms input into structured output formats.",
        "Testing is done with comprehensive integration and unit test suites.",
        "Additional unique architecture details about the project structure.",
        "Important conventions that are not mentioned anywhere else in docs.",
        "Line seven.",
        "Line eight.",
        "Line nine.",
        "Line ten.",
        "Line eleven.",
      ].join("\n");

      const ctx = createMockContext({
        "README.md": readme,
        "AGENTS.md": agentsMd,
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      // Check summary contains additionality with decimal format
      expect(result.summary).toMatch(/\d+\.\d%\s+additionality/);
      expect(result.summary).toMatch(/\d+\.\d%\s+redundancy/);
    });

    it("includes additionality metrics in summary", async () => {
      const readme = "# Project\nA simple readme with basic description of the project.";
      const agentsMd = [
        "# AGENTS.md",
        "## Architecture",
        "Unique architecture details not in README about the module structure.",
        "The provider pattern is used for all external service dependencies.",
        "Each module follows hexagonal architecture with ports and adapters pattern.",
        "## Conventions",
        "Use strict TypeScript with no any types across all packages.",
        "Line 8",
        "Line 9",
        "Line 10",
        "Line 11",
      ].join("\n");

      const ctx = createMockContext({
        "README.md": readme,
        "AGENTS.md": agentsMd,
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      expect(result.summary).toContain("Additionality:");
      expect(result.summary).toContain("AGENTS.md:");
    });

    it("reports line-level duplicative and additive content", async () => {
      const sharedContent = [
        "The project uses TypeScript with strict mode enabled for all packages",
        "Dependencies are managed with pnpm workspaces and turborepo orchestration",
        "All tests run with vitest and must pass before any code is merged",
      ];
      const readme = ["# Project", ...sharedContent.map((s) => s + ".")].join("\n");
      const agentsMd = [
        "# AGENTS.md",
        ...sharedContent.map((s) => s + "."),
        "Unique architecture detail about the analyzer pipeline and scoring system.",
        "Convention about finding codes that must follow the ARI prefix pattern.",
        "Line 7",
        "Line 8",
        "Line 9",
        "Line 10",
        "Line 11",
      ].join("\n");

      const ctx = createMockContext({
        "README.md": readme,
        "AGENTS.md": agentsMd,
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-CTX-011");
      expect(finding).toBeDefined();
      if (finding) {
        // Should contain line references for duplicative content
        expect(finding.message).toMatch(/L\d+:/);
        expect(finding.message).toContain("similar to");
        expect(finding.message).toContain("Duplicative:");
        expect(finding.message).toContain("Additive:");
      }
    });

    it("awards bonus points for high additionality", async () => {
      const readme = "# Project\nA brief project description for the readme file.";
      const agentsMdUnique = [
        "# AGENTS.md",
        "## Architecture Decisions",
        "The analyzer engine uses a provider pattern for all dependency injection.",
        "Each of the eight pillars has exactly one analyzer implementing the interface.",
        "## Build Conventions",
        "Finding codes follow the stable pattern ARI then PILLAR then three digits.",
        "Score clamping to zero through one hundred is mandatory in every single analyzer.",
        "## Common Pitfalls",
        "Forgetting the js extension in relative imports causes ESM resolution failures at runtime.",
        "Always build schema before testing engine due to cross package import dependencies.",
        "Never use console.log directly instead use the CLI formatter output layer.",
      ].join("\n");
      const agentsMdDuplicate = [
        "# AGENTS.md",
        "A brief project description for the readme file.",
        "A brief project description for the readme file.",
        "A brief project description for the readme file.",
        "A brief project description for the readme file.",
        "A brief project description for the readme file.",
        "A brief project description for the readme file.",
        "A brief project description for the readme file.",
        "A brief project description for the readme file.",
        "A brief project description for the readme file.",
        "A brief project description for the readme file.",
      ].join("\n");

      const ctxUnique = createMockContext({
        "README.md": readme,
        "AGENTS.md": agentsMdUnique,
      });
      const ctxDuplicate = createMockContext({
        "README.md": readme,
        "AGENTS.md": agentsMdDuplicate,
      });

      const resultUnique = await contextQualityAnalyzer.analyze(ctxUnique);
      const resultDuplicate = await contextQualityAnalyzer.analyze(ctxDuplicate);

      expect(resultUnique.score).toBeGreaterThan(resultDuplicate.score);
    });
  });

  describe("code-block additionality (Bug 6)", () => {
    it("detects duplicated commands inside code fences as redundant", async () => {
      // README has install/build/test commands in a code block
      const readme = [
        "# My Project",
        "## Getting Started",
        "Install dependencies and build the project with these commands:",
        "```bash",
        "pnpm install --frozen-lockfile",
        "pnpm build --filter engine",
        "pnpm test --run --reporter verbose",
        "pnpm lint --fix --quiet",
        "pnpm typecheck --noEmit --strict",
        "```",
        "## License",
        "MIT",
      ].join("\n");
      // AGENTS.md copies those same commands in code blocks
      const agentsMd = [
        "# AGENTS.md",
        "## Build Commands",
        "Install dependencies and build the project with these commands:",
        "```bash",
        "pnpm install --frozen-lockfile",
        "pnpm build --filter engine",
        "pnpm test --run --reporter verbose",
        "pnpm lint --fix --quiet",
        "pnpm typecheck --noEmit --strict",
        "```",
        "## Extra Guidance",
        "This unique project-specific guidance is only in the agents file.",
      ].join("\n");

      const ctx = createMockContext({
        "README.md": readme,
        "AGENTS.md": agentsMd,
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      // With code block content preserved, the redundancy should be detected
      const finding = result.findings.find((f) => f.code === "ARI-CTX-011");
      expect(finding).toBeDefined();
      expect(finding?.message).toContain("redundancy");
    });
  });

  describe("zero-segment additionality (Bug 5)", () => {
    it("does not award additionality bonus for files with no comparable segments", async () => {
      const readme = "# Project\nA brief description of the project.";
      // Very short AGENTS.md where all segments are < 5 words (prose) and
      // not command-like, so none pass the segment filter
      const agentsMd = [
        "# AGENTS.md",
        "## Build",
        "See above.",
        "## Notes",
        "Short.",
        "Tiny.",
        "Small.",
        "OK.",
        "Yes.",
        "Done.",
        "Fine.",
      ].join("\n");

      const ctx = createMockContext({
        "README.md": readme,
        "AGENTS.md": agentsMd,
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      // Should not get the +5 additionality bonus since no segments were analyzed
      // Summary should indicate no comparable segments
      expect(result.summary).toContain("no comparable segments");
    });
  });

  describe("moderate redundancy finding (Bug 4)", () => {
    it("emits ARI-CTX-011 info finding for 30-50% redundancy", async () => {
      // Create content where ~40% of segments match README
      const sharedLines = [
        "This project uses TypeScript with strict mode enabled for type safety",
        "Dependencies are managed with pnpm workspaces and turborepo orchestration",
      ];
      const uniqueLines = [
        "The analyzer engine follows a provider pattern for dependency injection",
        "Each pillar has exactly one analyzer implementing the PillarAnalyzer interface",
        "Finding codes follow the stable pattern ARI then PILLAR then three digit number",
      ];
      const readme = ["# Project", ...sharedLines.map((s) => s + ".")].join("\n");
      const agentsMd = [
        "# AGENTS.md",
        ...sharedLines.map((s) => s + "."),
        ...uniqueLines.map((s) => s + "."),
        "Line 8",
        "Line 9",
        "Line 10",
        "Line 11",
      ].join("\n");

      const ctx = createMockContext({
        "README.md": readme,
        "AGENTS.md": agentsMd,
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      const finding = result.findings.find(
        (f) => f.code === "ARI-CTX-011" && f.severity === "info",
      );
      expect(finding).toBeDefined();
      expect(finding?.message).toContain("redundancy");
    });
  });

  describe("LLM-generated file penalty (ARI-CTX-012)", () => {
    it("emits ARI-CTX-012 for boilerplate file with high redundancy", async () => {
      const readme = [
        "# My Project",
        "This project is a web application built with modern tools and frameworks.",
        "It uses TypeScript for type safety and React for the user interface layer.",
        "The build system is configured with webpack for optimal bundle optimization.",
        "Testing is handled by Jest with comprehensive coverage requirements enabled.",
        "Continuous integration runs on GitHub Actions with automated deployment pipelines.",
      ].join("\n");
      const agentsMd = [
        "# AGENTS.md",
        "",
        "This project is a web application built with modern tools and frameworks.",
        "It uses TypeScript for type safety and React for the user interface layer.",
        "The build system is configured with webpack for optimal bundle optimization.",
        "Testing is handled by Jest with comprehensive coverage requirements enabled.",
        "Continuous integration runs on GitHub Actions with automated deployment pipelines.",
        "",
        "Generated by auto-project-scaffolder.",
        "Line 10.",
        "Line 11.",
      ].join("\n");

      const ctx = createMockContext({
        "README.md": readme,
        "AGENTS.md": agentsMd,
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-CTX-012");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("high");
      expect(finding?.message).toContain("LLM-generated");
      expect(finding?.evidence?.paper).toContain("Gloaguen");
    });

    it("does not emit ARI-CTX-012 for non-boilerplate with some redundancy", async () => {
      const readme = [
        "# Project Overview",
        "This application processes data pipelines for analytics and reporting purposes.",
        "Built with Python and FastAPI for high performance API serving.",
      ].join("\n");
      const agentsMd = [
        "# AGENTS.md",
        "## Conventions",
        "This application processes data pipelines for analytics and reporting purposes.",
        "Always use dependency injection for database connections in the service layer.",
        "Never commit credentials or API keys to the repository configuration.",
        "Use structured logging with correlation IDs for all service requests.",
        "Line 7.",
        "Line 8.",
        "Line 9.",
        "Line 10.",
        "Line 11.",
      ].join("\n");

      const ctx = createMockContext({
        "README.md": readme,
        "AGENTS.md": agentsMd,
        "src/pipeline/run.py": "# pipeline runner",
      });
      const result = await contextQualityAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-CTX-012")).toBe(false);
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

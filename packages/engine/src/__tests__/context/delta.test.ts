import { describe, it, expect } from "vitest";
import { createMockContext } from "../helpers.js";
import { diffContext } from "../../context/diff.js";
import type { DetectionResult } from "@prontiq/ariscan-schema";

function makeDetection(overrides?: Partial<DetectionResult>): DetectionResult {
  return {
    languages: [{ language: "TypeScript", confidence: 0.9, primary: true }],
    frameworks: [],
    monorepo: null,
    ...overrides,
  };
}

describe("diffContext", () => {
  it("returns empty result when no context files exist", async () => {
    const ctx = createMockContext({
      "src/index.ts": "export const foo = 1;",
      "README.md": "# My Project",
    });
    const result = await diffContext(ctx, makeDetection());
    expect(result.totalFiles).toBe(0);
    expect(result.files).toEqual([]);
    expect(result.recommendations).toEqual([]);
  });

  it("analyzes a single context file against repo docs", async () => {
    const ctx = createMockContext({
      "AGENTS.md": `# Agent Instructions

This project uses a completely custom architecture with unique patterns
that cannot be found anywhere else in the repository documentation.
Never use the deprecated v1 API when building new integration tests.
Always prefer streaming responses over polling for real-time updates.`,
      "README.md": "# My Project\nA simple project with basic documentation.",
    });
    const result = await diffContext(ctx, makeDetection());
    expect(result.totalFiles).toBe(1);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.path).toBe("AGENTS.md");
    expect(result.files[0]?.additivePct).toBeGreaterThan(0);
    expect(result.files[0]?.tokenEstimate).toBeGreaterThan(0);
  });

  it("detects duplicated content between two context files", async () => {
    const shared =
      "Install dependencies with pnpm install then build with pnpm build and run tests with pnpm test for verification";
    const ctx = createMockContext({
      "AGENTS.md": `# AGENTS.md\n\n${shared}\n\n${shared}`,
      "CLAUDE.md": `# CLAUDE.md\n\n${shared}\n\nClaude-specific instructions for code review processes`,
    });
    const result = await diffContext(ctx, makeDetection());
    expect(result.totalFiles).toBe(2);

    // At least one file should have duplicative-context segments
    const hasCrossFileDup = result.files.some((f) => f.duplicativeContextPct > 0);
    expect(hasCrossFileDup).toBe(true);
  });

  it("identifies fully duplicated files and recommends merge", async () => {
    const content = `This project requires special build steps that are not documented elsewhere.
Use pnpm install to bootstrap then pnpm build to compile all packages.
Run pnpm test to execute the full test suite before submitting changes.
Never modify the generated output files in the dist directory manually.
Always prefer the TypeScript strict mode configuration over loose settings.`;

    const ctx = createMockContext({
      "AGENTS.md": `# AGENTS.md\n\n${content}`,
      "CLAUDE.md": `# CLAUDE.md\n\n${content}`,
    });
    const result = await diffContext(ctx, makeDetection());
    expect(result.totalFiles).toBe(2);

    // Should recommend merging since content is identical
    const mergeRec = result.recommendations.find((r) => r.action === "merge");
    expect(mergeRec).toBeDefined();
    expect(mergeRec?.overlapPct).toBeGreaterThan(40);
  });

  it("classifies unique content as additive", async () => {
    const ctx = createMockContext({
      "AGENTS.md": `# AGENTS.md

This project uses a completely unique custom build pipeline
with special preprocessors that transform source files before compilation.
The architecture follows a hexagonal pattern with ports and adapters.`,
      "CLAUDE.md": `# CLAUDE.md

Claude should always use the streaming API for long-running operations.
Prefer functional programming patterns over object-oriented design in utilities.
Never use console.log for debugging in production code paths.`,
      "README.md": "# My Project\nA basic project description.",
    });
    const result = await diffContext(ctx, makeDetection());
    expect(result.totalFiles).toBe(2);

    // Both files should have high additive percentages since they're unique
    for (const file of result.files) {
      expect(file.additivePct).toBeGreaterThan(0);
    }
  });

  it("detects content duplicating repo documentation", async () => {
    const readmeContent =
      "Install dependencies with pnpm install then build all packages with pnpm build and verify with pnpm test";
    const ctx = createMockContext({
      "AGENTS.md": `# AGENTS.md\n\n${readmeContent}\n\n${readmeContent}`,
      "README.md": `# My Project\n\n${readmeContent}`,
    });
    const result = await diffContext(ctx, makeDetection());
    expect(result.totalFiles).toBe(1);

    const agentsFile = result.files[0];
    expect(agentsFile?.path).toBe("AGENTS.md");
    expect(agentsFile?.duplicativeRepoPct).toBeGreaterThan(0);
  });

  it("produces valid segment classifications", async () => {
    const ctx = createMockContext({
      "AGENTS.md": `# AGENTS.md

This project has unique build requirements not documented elsewhere.
Never use the deprecated legacy API endpoints in integration tests.`,
    });
    const result = await diffContext(ctx, makeDetection());
    expect(result.files).toHaveLength(1);

    const file = result.files[0];
    expect(file).toBeDefined();
    for (const seg of file?.segments ?? []) {
      expect(["additive", "duplicative-repo", "duplicative-context", "overlapping"]).toContain(
        seg.classification,
      );
      expect(seg.similarity).toBeGreaterThanOrEqual(0);
      expect(seg.similarity).toBeLessThanOrEqual(1);
    }
  });

  it("includes token estimates for each file", async () => {
    const ctx = createMockContext({
      "AGENTS.md":
        "# AGENTS.md\n\nSome unique content for this specific project.\nNever use raw SQL queries without parameterization in this codebase.",
    });
    const result = await diffContext(ctx, makeDetection());
    expect(result.files[0]?.tokenEstimate).toBeGreaterThan(0);
  });

  it("handles files with no comparable segments gracefully", async () => {
    const ctx = createMockContext({
      "AGENTS.md": "# A\nHi",
    });
    const result = await diffContext(ctx, makeDetection());
    expect(result.totalFiles).toBe(1);
    // Should not throw; percentages should be valid numbers
    const file = result.files[0];
    expect(file).toBeDefined();
    expect(typeof file?.additivePct).toBe("number");
  });
});

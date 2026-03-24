import { describe, it, expect } from "vitest";
import { createMockContext } from "../helpers.js";
import { auditAgentsMd, discoverContextFiles } from "../../audit/agents-md.js";
import type { DetectionResult } from "@prontiq/ariscan-schema";

function makeDetection(overrides?: Partial<DetectionResult>): DetectionResult {
  return {
    languages: [{ language: "TypeScript", confidence: 0.9, primary: true }],
    frameworks: [],
    monorepo: null,
    ...overrides,
  };
}

describe("discoverContextFiles", () => {
  it("finds AGENTS.md", async () => {
    const ctx = createMockContext({ "AGENTS.md": "content" });
    const files = await discoverContextFiles(ctx);
    expect(files).toContain("AGENTS.md");
  });

  it("finds CLAUDE.md", async () => {
    const ctx = createMockContext({ "CLAUDE.md": "content" });
    const files = await discoverContextFiles(ctx);
    expect(files).toContain("CLAUDE.md");
  });

  it("finds nested AGENTS.md in monorepo", async () => {
    const ctx = createMockContext({
      "AGENTS.md": "root",
      "packages/web/AGENTS.md": "web",
    });
    const files = await discoverContextFiles(ctx);
    expect(files).toContain("packages/web/AGENTS.md");
  });

  it("returns empty for repos without context files", async () => {
    const ctx = createMockContext({ "src/index.ts": "export const foo = 1;" });
    const files = await discoverContextFiles(ctx);
    expect(files).toEqual([]);
  });
});

describe("redundancy scoring", () => {
  it("reports low redundancy for unique content", async () => {
    const ctx = createMockContext({
      "AGENTS.md": `# AGENTS.md

This project uses a completely custom build system that cannot be discovered
from any other file in the repository. The architecture follows a novel pattern
that is entirely unique to this codebase and not documented elsewhere.
Never use the deprecated v1 API endpoints in any integration tests.
Always prefer the new streaming API over polling for real-time data.`,
      "README.md": "# My Project\nA simple project with nothing special.",
    });

    const detection = makeDetection();
    const results = await auditAgentsMd(ctx, detection);
    expect(results.length).toBe(1);
    const redundancyDim = results[0]?.dimensions.find((d) => d.id === "redundancy");
    expect(redundancyDim?.score).toBeGreaterThan(50);
  });

  it("reports high redundancy for duplicated content", async () => {
    const shared =
      "Install dependencies with pnpm install then build with pnpm build and run tests with pnpm test for verification";
    const ctx = createMockContext({
      "AGENTS.md": `# AGENTS.md\n\n${shared}\n\n${shared}\n\n${shared}`,
      "README.md": `# My Project\n\n${shared}`,
    });

    const detection = makeDetection();
    const results = await auditAgentsMd(ctx, detection);
    const redundancyDim = results[0]?.dimensions.find((d) => d.id === "redundancy");
    expect(redundancyDim?.score).toBeLessThan(80);
  });
});

describe("staleness scoring", () => {
  it("detects package manager contradiction", async () => {
    const ctx = createMockContext({
      "AGENTS.md": "# Guide\n\nUse yarn to install dependencies.",
      "pnpm-lock.yaml": "lockfileVersion: '9.0'",
      "package.json": JSON.stringify({ name: "test" }),
    });

    const detection = makeDetection();
    const results = await auditAgentsMd(ctx, detection);
    const stalenessIssues = results[0]?.issues.filter((i) => i.dimension === "staleness") ?? [];
    expect(stalenessIssues.length).toBeGreaterThan(0);
    expect(stalenessIssues[0]?.severity).toBe("critical");
  });

  it("no staleness when package manager matches", async () => {
    const ctx = createMockContext({
      "AGENTS.md": "# Guide\n\nUse pnpm to install dependencies.",
      "pnpm-lock.yaml": "lockfileVersion: '9.0'",
    });

    const detection = makeDetection();
    const results = await auditAgentsMd(ctx, detection);
    const stalenessIssues = results[0]?.issues.filter((i) => i.dimension === "staleness") ?? [];
    // Should have no package-manager contradiction
    const pkgMgrIssue = stalenessIssues.find(
      (i) =>
        i.message.includes("package manager") ||
        (i.message.includes("npm") && i.message.includes("pnpm")),
    );
    expect(pkgMgrIssue).toBeUndefined();
  });

  it("resolves path references relative to nested context file directory", async () => {
    // packages/web/AGENTS.md references `src/index.ts` which exists at
    // packages/web/src/index.ts — should NOT produce a staleness warning
    const ctx = createMockContext({
      "packages/web/AGENTS.md":
        "# Web Package\n\nThe entry point is `src/index.ts` and tests are in `tests/setup.ts`.",
      "packages/web/src/index.ts": "export default {};",
      "packages/web/tests/setup.ts": "// setup",
    });

    const detection = makeDetection();
    const results = await auditAgentsMd(ctx, detection);
    const stalenessIssues = results[0]?.issues.filter((i) => i.dimension === "staleness") ?? [];
    // Should not flag src/index.ts or tests/setup.ts as missing
    const pathIssues = stalenessIssues.filter((i) => i.message.includes("does not exist"));
    expect(pathIssues).toHaveLength(0);
  });

  it("does not flag bare extensions like .js or .ts as missing file references", async () => {
    // Prose like "Never import without .js extension" should not trigger a
    // staleness warning for a missing file named ".js".
    const ctx = createMockContext({
      "AGENTS.md":
        "# Guide\n\nNever import without the .js extension for ESM compatibility.\nAlways use .ts files.\nPrefer .md for docs.",
    });

    const detection = makeDetection();
    const results = await auditAgentsMd(ctx, detection);
    const stalenessIssues = results[0]?.issues.filter((i) => i.dimension === "staleness") ?? [];
    const bareExtIssues = stalenessIssues.filter(
      (i) =>
        (i.message.includes("'.js'") ||
          i.message.includes("'.ts'") ||
          i.message.includes("'.md'")) &&
        i.message.includes("does not exist"),
    );
    expect(bareExtIssues).toHaveLength(0);
  });

  it("does not flag dotted prose tokens like Node.js or Express.js as missing files", async () => {
    const ctx = createMockContext({
      "AGENTS.md":
        "# Guide\n\nThis project uses Node.js and Express.js for the backend.\nWe also use Next.js for the frontend and Deno.js for scripts.",
    });

    const detection = makeDetection();
    const results = await auditAgentsMd(ctx, detection);
    const stalenessIssues = results[0]?.issues.filter((i) => i.dimension === "staleness") ?? [];
    const proseTokenIssues = stalenessIssues.filter(
      (i) =>
        (i.message.includes("'Node.js'") ||
          i.message.includes("'Express.js'") ||
          i.message.includes("'Next.js'") ||
          i.message.includes("'Deno.js'")) &&
        i.message.includes("does not exist"),
    );
    expect(proseTokenIssues).toHaveLength(0);
  });

  it("generates correct fix text for package manager contradiction", async () => {
    const ctx = createMockContext({
      "AGENTS.md": "# Guide\n\nUse yarn to install dependencies.",
      "pnpm-lock.yaml": "lockfileVersion: '9.0'",
      "package.json": JSON.stringify({ name: "test" }),
    });

    const detection = makeDetection();
    const results = await auditAgentsMd(ctx, detection);
    const stalenessIssues = results[0]?.issues.filter((i) => i.dimension === "staleness") ?? [];
    const pkgIssue = stalenessIssues.find((i) => i.message.includes("package manager"));
    expect(pkgIssue).toBeDefined();
    // The fix should preserve "Use" and replace only "yarn" with "pnpm"
    expect(pkgIssue?.fix).toBe("Use pnpm to install dependencies.");
  });

  it("does not suppress staleness for standalone filenames via root fallback in nested files", async () => {
    // packages/web/AGENTS.md references "package.json" and "setup.cfg" which
    // exist only at repo root, NOT at packages/web/. These are non-global
    // standalone filenames, so they should produce staleness warnings.
    // Note: README.md IS repo-global and should NOT be flagged (tested separately).
    const ctx = createMockContext({
      "packages/web/AGENTS.md":
        "# Web Package\n\nSee `package.json` for scripts.\nCheck `setup.cfg` for config.",
      "package.json": JSON.stringify({ name: "root" }),
      "setup.cfg": "[metadata]",
    });

    const detection = makeDetection();
    const results = await auditAgentsMd(ctx, detection);
    const stalenessIssues = results[0]?.issues.filter((i) => i.dimension === "staleness") ?? [];
    const pathIssues = stalenessIssues.filter((i) => i.message.includes("does not exist"));
    // Both package.json and setup.cfg should be flagged as missing (package-relative)
    expect(pathIssues.length).toBeGreaterThanOrEqual(2);
    expect(pathIssues.some((i) => i.message.includes("package.json"))).toBe(true);
    expect(pathIssues.some((i) => i.message.includes("setup.cfg"))).toBe(true);
  });

  it("flags slash-containing paths in nested files when only root has them", async () => {
    // packages/web/AGENTS.md references "docs/guide.md" which exists at repo
    // root as docs/guide.md but NOT at packages/web/docs/guide.md.
    // Nested context files should NOT fall back to repo root — this is a
    // package-local reference that should be flagged as stale.
    const ctx = createMockContext({
      "packages/web/AGENTS.md": "# Web Package\n\nSee `docs/guide.md` for architecture.",
      "docs/guide.md": "# Architecture Guide",
    });

    const detection = makeDetection();
    const results = await auditAgentsMd(ctx, detection);
    const stalenessIssues = results[0]?.issues.filter((i) => i.dimension === "staleness") ?? [];
    const pathIssues = stalenessIssues.filter(
      (i) => i.message.includes("docs/guide.md") && i.message.includes("does not exist"),
    );
    expect(pathIssues.length).toBeGreaterThanOrEqual(1);
  });

  it("flags truly missing path references in nested context files", async () => {
    const ctx = createMockContext({
      "packages/web/AGENTS.md": "# Web Package\n\nSee `src/missing-file.ts` for details.",
    });

    const detection = makeDetection();
    const results = await auditAgentsMd(ctx, detection);
    const stalenessIssues = results[0]?.issues.filter((i) => i.dimension === "staleness") ?? [];
    const pathIssues = stalenessIssues.filter(
      (i) => i.message.includes("src/missing-file.ts") && i.message.includes("does not exist"),
    );
    expect(pathIssues.length).toBeGreaterThan(0);
  });

  it("normalizes dot-segment references before checking existence", async () => {
    // packages/web/AGENTS.md references "./src/index.ts" and "../README.md"
    // which should resolve to packages/web/src/index.ts and packages/README.md
    const ctx = createMockContext({
      "packages/web/AGENTS.md":
        "# Web Package\n\nEntry point is `./src/index.ts`.\nSee `../README.md` for the parent docs.",
      "packages/web/src/index.ts": "export default {};",
      "packages/README.md": "# Packages README",
    });

    const detection = makeDetection();
    const results = await auditAgentsMd(ctx, detection);
    const stalenessIssues = results[0]?.issues.filter((i) => i.dimension === "staleness") ?? [];
    const pathIssues = stalenessIssues.filter((i) => i.message.includes("does not exist"));
    // Neither ./src/index.ts nor ../README.md should be flagged
    expect(pathIssues.filter((i) => i.message.includes("src/index.ts"))).toHaveLength(0);
    expect(pathIssues.filter((i) => i.message.includes("README.md"))).toHaveLength(0);
  });

  it("allows repo-global workspace files referenced from nested context files", async () => {
    // packages/web/AGENTS.md references pnpm-workspace.yaml, turbo.json,
    // .github/workflows/ci.yml, and README.md — all legitimate repo-global references
    const ctx = createMockContext({
      "packages/web/AGENTS.md":
        "# Web Package\n\nWorkspace config is in `pnpm-workspace.yaml`.\nBuild config in `turbo.json`.\nCI defined in `.github/workflows/ci.yml`.\nSee `README.md` for project overview.",
      "pnpm-workspace.yaml": "packages:\n  - packages/*",
      "turbo.json": '{"pipeline":{}}',
      ".github/workflows/ci.yml": "name: CI",
      "README.md": "# Project",
    });

    const detection = makeDetection();
    const results = await auditAgentsMd(ctx, detection);
    const stalenessIssues = results[0]?.issues.filter((i) => i.dimension === "staleness") ?? [];
    const pathIssues = stalenessIssues.filter((i) => i.message.includes("does not exist"));
    // None of these repo-global files should be flagged as missing
    expect(pathIssues.filter((i) => i.message.includes("pnpm-workspace.yaml"))).toHaveLength(0);
    expect(pathIssues.filter((i) => i.message.includes("turbo.json"))).toHaveLength(0);
    expect(pathIssues.filter((i) => i.message.includes(".github/workflows/ci.yml"))).toHaveLength(
      0,
    );
    expect(pathIssues.filter((i) => i.message.includes("README.md"))).toHaveLength(0);
  });

  it("still flags non-global files in nested context files without root fallback", async () => {
    // packages/web/AGENTS.md references "src/utils.ts" which only exists at
    // root src/utils.ts — this is NOT a repo-global file and should be flagged
    const ctx = createMockContext({
      "packages/web/AGENTS.md": "# Web Package\n\nShared utils in `src/utils.ts`.",
      "src/utils.ts": "export const util = 1;",
    });

    const detection = makeDetection();
    const results = await auditAgentsMd(ctx, detection);
    const stalenessIssues = results[0]?.issues.filter((i) => i.dimension === "staleness") ?? [];
    const pathIssues = stalenessIssues.filter(
      (i) => i.message.includes("src/utils.ts") && i.message.includes("does not exist"),
    );
    expect(pathIssues.length).toBeGreaterThanOrEqual(1);
  });
});

describe("instruction clarity scoring", () => {
  it("flags vague instructions", async () => {
    const ctx = createMockContext({
      "AGENTS.md": `# AGENTS.md

Follow best practices when writing code.
Keep it clean and readable.
Use proper error handling.
Write good tests.`,
    });

    const detection = makeDetection();
    const results = await auditAgentsMd(ctx, detection);
    const clarityIssues = results[0]?.issues.filter((i) => i.dimension === "clarity") ?? [];
    expect(clarityIssues.length).toBeGreaterThanOrEqual(3);
    expect(clarityIssues[0]?.fix).toBeDefined();
  });

  it("scores high for specific instructions", async () => {
    const ctx = createMockContext({
      "AGENTS.md": `# AGENTS.md

You must always use TypeScript strict mode with no any types.
Never import without the .js extension for ESM compatibility.
Always run pnpm test before committing changes to the repository.
Use vitest for all unit tests and mock filesystem with RepoContext.
Export types from the schema package using Zod validation always.`,
    });

    const detection = makeDetection();
    const results = await auditAgentsMd(ctx, detection);
    const clarityDim = results[0]?.dimensions.find((d) => d.id === "clarity");
    expect(clarityDim?.score).toBeGreaterThan(30);
  });
});

describe("front-loading scoring", () => {
  it("scores high when critical info is at top", async () => {
    const ctx = createMockContext({
      "AGENTS.md": `# AGENTS.md

## Build Commands

\`\`\`bash
pnpm install
pnpm build
pnpm test
\`\`\`

## Architecture

This is a monorepo with three packages.

## Other stuff

Additional details that are less critical.
More content here to pad the file.
Even more padding content.
And more lines of content.
Additional filler text here.
Yet another line of text.`,
    });

    const detection = makeDetection();
    const results = await auditAgentsMd(ctx, detection);
    const frontLoadDim = results[0]?.dimensions.find((d) => d.id === "front-loading");
    expect(frontLoadDim?.score).toBeGreaterThan(30);
  });
});

describe("negative instruction coverage", () => {
  it("scores high with multiple do-NOT constraints", async () => {
    const ctx = createMockContext({
      "AGENTS.md": `# AGENTS.md

Do NOT use the any type.
Never import without .js extension.
Avoid using console.log in production code.
Don't bypass the RepoContext abstraction.
Must not modify pillar weights without calibration notes.`,
    });

    const detection = makeDetection();
    const results = await auditAgentsMd(ctx, detection);
    const negativeDim = results[0]?.dimensions.find((d) => d.id === "negative-instructions");
    expect(negativeDim?.score).toBeGreaterThanOrEqual(80);
  });

  it("recognizes lowercase 'do not' instructions", async () => {
    const ctx = createMockContext({
      "AGENTS.md": `# AGENTS.md

do not use the any type in TypeScript code.
do not import without .js extension.
Always use strict mode.`,
    });

    const detection = makeDetection();
    const results = await auditAgentsMd(ctx, detection);
    const negativeDim = results[0]?.dimensions.find((d) => d.id === "negative-instructions");
    // Lowercase "do not" must be counted — regression test for case-insensitive fix
    expect(negativeDim?.score).toBeGreaterThanOrEqual(50);
    const negativeIssues =
      results[0]?.issues.filter((i) => i.dimension === "negative-instructions") ?? [];
    // Should NOT warn about missing negative instructions since we have two
    const missingWarning = negativeIssues.find((i) =>
      i.message.toLowerCase().includes("no negative"),
    );
    expect(missingWarning).toBeUndefined();
  });

  it("warns when no negative instructions present", async () => {
    const ctx = createMockContext({
      "AGENTS.md": "# AGENTS.md\n\nThis project uses TypeScript.\nRun pnpm build to compile.",
    });

    const detection = makeDetection();
    const results = await auditAgentsMd(ctx, detection);
    const negativeDim = results[0]?.dimensions.find((d) => d.id === "negative-instructions");
    expect(negativeDim?.score).toBeLessThan(50);
    const negativeIssues =
      results[0]?.issues.filter((i) => i.dimension === "negative-instructions") ?? [];
    expect(negativeIssues.length).toBeGreaterThan(0);
  });
});

describe("cross-agent compatibility", () => {
  it("scores higher with multiple agent references", async () => {
    const ctx = createMockContext({
      "AGENTS.md": "# For all AI coding agents — Claude, Copilot, Cursor, Codex",
      "CLAUDE.md": "# Claude-specific instructions",
      ".cursorrules": "cursor rules here",
    });

    const detection = makeDetection();
    const results = await auditAgentsMd(ctx, detection);
    const agentsMdResult = results.find((r) => r.filePath === "AGENTS.md");
    const crossAgentDim = agentsMdResult?.dimensions.find((d) => d.id === "cross-agent");
    expect(crossAgentDim?.score).toBeGreaterThan(40);
  });
});

describe("token budget scoring", () => {
  it("scores high for short files", async () => {
    const ctx = createMockContext({
      "AGENTS.md": "# AGENTS.md\n\nShort and focused context.",
    });

    const detection = makeDetection();
    const results = await auditAgentsMd(ctx, detection);
    const tokenDim = results[0]?.dimensions.find((d) => d.id === "token-budget");
    expect(tokenDim?.score).toBe(100);
    expect(results[0]?.tokenEstimate).toBeLessThan(2000);
  });

  it("warns for very large files", async () => {
    const longContent = "A".repeat(40000) + "\n"; // ~10k tokens
    const ctx = createMockContext({
      "AGENTS.md": `# AGENTS.md\n\n${longContent}`,
    });

    const detection = makeDetection();
    const results = await auditAgentsMd(ctx, detection);
    const tokenDim = results[0]?.dimensions.find((d) => d.id === "token-budget");
    expect(tokenDim?.score).toBeLessThan(80);
  });
});

describe("overall audit", () => {
  it("returns empty for repo without context files", async () => {
    const ctx = createMockContext({ "src/index.ts": "export const foo = 1;" });
    const detection = makeDetection();
    const results = await auditAgentsMd(ctx, detection);
    expect(results).toEqual([]);
  });

  it("includes empty context files in results with score 0 and critical issue", async () => {
    const ctx = createMockContext({
      "AGENTS.md": "",
    });

    const detection = makeDetection();
    const results = await auditAgentsMd(ctx, detection);
    // Empty files must NOT be silently skipped — regression test for content != null fix
    expect(results.length).toBe(1);
    expect(results[0]?.filePath).toBe("AGENTS.md");
    // Empty files must score 0 — they are completely unusable
    expect(results[0]?.overallScore).toBe(0);
    // All dimension scores must be 0
    for (const dim of results[0]?.dimensions ?? []) {
      expect(dim.score).toBe(0);
    }
    // Must have a critical issue
    expect(results[0]?.issues.length).toBeGreaterThan(0);
    expect(results[0]?.issues[0]?.severity).toBe("critical");
  });

  it("audits multiple context files independently", async () => {
    const ctx = createMockContext({
      "AGENTS.md": "# AGENTS\nGeneral instructions for all agents.",
      "CLAUDE.md": "# Claude\nClaude-specific instructions.",
    });

    const detection = makeDetection();
    const results = await auditAgentsMd(ctx, detection);
    expect(results.length).toBe(2);
    expect(results[0]?.filePath).toBe("AGENTS.md");
    expect(results[1]?.filePath).toBe("CLAUDE.md");
  });

  it("produces severity-ranked issues", async () => {
    const ctx = createMockContext({
      "AGENTS.md": `# Guide
Use npm to install.
Follow best practices.
Keep it clean.`,
      "pnpm-lock.yaml": "lockfileVersion: '9.0'",
      "package.json": JSON.stringify({ name: "test" }),
    });

    const detection = makeDetection();
    const results = await auditAgentsMd(ctx, detection);
    const issues = results[0]?.issues ?? [];
    // Issues should be sorted by severity
    for (let i = 1; i < issues.length; i++) {
      const severityOrder = { critical: 0, warning: 1, info: 2 } as const;
      const prev = issues[i - 1];
      const curr = issues[i];
      if (prev && curr) {
        expect(severityOrder[prev.severity]).toBeLessThanOrEqual(severityOrder[curr.severity]);
      }
    }
  });

  it("includes fix examples that are actionable", async () => {
    const ctx = createMockContext({
      "AGENTS.md": "# Guide\nFollow best practices.\nUse proper error handling.",
    });

    const detection = makeDetection();
    const results = await auditAgentsMd(ctx, detection);
    const issuesWithFixes = results[0]?.issues.filter((i) => i.fix) ?? [];
    expect(issuesWithFixes.length).toBeGreaterThan(0);
    for (const issue of issuesWithFixes) {
      expect(issue.fix).toBeTruthy();
      expect(typeof issue.fix).toBe("string");
    }
  });

  it("reports redundancy to one decimal place", async () => {
    const ctx = createMockContext({
      "AGENTS.md":
        "# AGENTS.md\n\nUse pnpm install to set up the project. Then run pnpm build to compile and pnpm test for tests.",
      "README.md":
        "# Readme\n\nUse pnpm install to set up the project. Then run pnpm build to compile and pnpm test for tests.",
    });

    const detection = makeDetection();
    const results = await auditAgentsMd(ctx, detection);
    const redundancyDim = results[0]?.dimensions.find((d) => d.id === "redundancy");
    // Details should contain one decimal place
    expect(redundancyDim?.details).toMatch(/\d+\.\d%/);
  });
});

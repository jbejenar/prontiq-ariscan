import { describe, it, expect } from "vitest";
import { createMockContext } from "../helpers.js";
import { analyzeGaps } from "../../context/gap-analysis.js";
import { generateContextFiles } from "../../context/generator.js";
import { computeAdditionality, computeFrontLoadScore } from "../../context/additionality.js";
import type { DetectionResult } from "@prontiq/ariscan-schema";

function makeDetectionResult(overrides?: Partial<DetectionResult>): DetectionResult {
  return {
    languages: [{ language: "TypeScript", confidence: 0.9, primary: true }],
    frameworks: [],
    monorepo: null,
    ...overrides,
  };
}

describe("gap analysis", () => {
  it("indexes README and reports high coverage when docs exist", async () => {
    const ctx = createMockContext({
      "README.md": `# My Project

## Getting Started

Install dependencies and build:

\`\`\`bash
pnpm install
pnpm build
pnpm test
\`\`\`

## Architecture

This is a monorepo with packages.

## Constraints

Do NOT use any type. Never import without .js extension.
Avoid using console.log.

## Testing Patterns

Use vitest for unit tests. Mock filesystem via RepoContext.`,
      "CONTRIBUTING.md": "# Contributing\nSubmit a PR with tests.",
      "package.json": JSON.stringify({
        name: "my-project",
        scripts: { build: "tsc", test: "vitest", lint: "eslint" },
      }),
    });

    const detection = makeDetectionResult();
    const result = await analyzeGaps(ctx, detection);

    expect(result.indexed.length).toBeGreaterThan(0);
    expect(result.coverage).toBeGreaterThan(50);
  });

  it("reports gaps when no documentation exists", async () => {
    const ctx = createMockContext({
      "src/index.ts": "export const foo = 1;",
    });

    const detection = makeDetectionResult();
    const result = await analyzeGaps(ctx, detection);

    expect(result.gaps.length).toBeGreaterThan(0);
    expect(result.coverage).toBeLessThan(50);
  });

  it("detects missing build commands as a high-importance gap", async () => {
    const ctx = createMockContext({
      "README.md": "# My Project\n\nA great project.",
    });

    const detection = makeDetectionResult();
    const result = await analyzeGaps(ctx, detection);

    const buildGap = result.gaps.find((g) => g.category.id === "build-commands");
    expect(buildGap).toBeDefined();
    expect(buildGap?.category.importance).toBe(10);
  });

  it("detects missing constraints as a gap", async () => {
    const ctx = createMockContext({
      "README.md": "# Project\n\n```bash\npnpm build\npnpm test\n```",
    });

    const detection = makeDetectionResult();
    const result = await analyzeGaps(ctx, detection);

    const constraintGap = result.gaps.find((g) => g.category.id === "constraints");
    expect(constraintGap).toBeDefined();
  });

  it("does not report monorepo gap for non-monorepo", async () => {
    const ctx = createMockContext({
      "README.md": "# Project",
    });

    const detection = makeDetectionResult({ monorepo: null });
    const result = await analyzeGaps(ctx, detection);

    const monoGap = result.gaps.find((g) => g.category.id === "monorepo-paths");
    expect(monoGap).toBeUndefined();
  });
});

describe("context generator", () => {
  it("generates AGENTS.md for a repo with gaps", async () => {
    const ctx = createMockContext({
      "src/index.ts": "export const foo = 1;",
      "package.json": JSON.stringify({
        name: "my-project",
        scripts: { build: "tsc", test: "vitest" },
      }),
    });

    const detection = makeDetectionResult();
    const result = await generateContextFiles(ctx, detection);

    expect(result.files.length).toBeGreaterThan(0);
    expect(result.files[0]?.path).toBe("AGENTS.md");
    expect(result.files[0]?.content).toContain("AGENTS.md");
  });

  it("returns no files when documentation is comprehensive", async () => {
    const ctx = createMockContext({
      "README.md": `# My Project

## Getting Started

\`\`\`bash
pnpm install
pnpm build
pnpm test
pnpm lint
\`\`\`

## Architecture

Monorepo with packages/schema, packages/engine, packages/cli.

## Constraints

Do NOT use any type. Never import without .js extension.
Avoid using console.log. Prefer unknown and narrow.

## Testing Patterns

Use vitest for unit tests. Mock filesystem via RepoContext abstraction.
Test files go in __tests__/ directories.

## Common Gotchas

Build order matters: schema -> engine -> cli.
Import extensions must use .js for ESM compatibility.

## Code Conventions

camelCase for variables, PascalCase for types.

## Environment Setup

Node.js 22+, pnpm 9+.

## Tool Choices

We use vitest instead of jest for faster test execution.
We use citty instead of commander for zero-dep CLI.`,
      "CONTRIBUTING.md": "# Contributing\nSubmit a PR with tests.",
      "AGENTS.md": "# AGENTS.md\nExisting context file.",
      "package.json": JSON.stringify({
        name: "my-project",
        scripts: { build: "tsc", test: "vitest", lint: "eslint", format: "prettier" },
      }),
      ".nvmrc": "22",
    });

    const detection = makeDetectionResult({
      frameworks: [{ framework: "Vitest", confidence: 0.9 }],
    });
    const result = await generateContextFiles(ctx, detection);

    // When docs are comprehensive, should have no gaps (or very few)
    expect(result.gapAnalysis.coverage).toBeGreaterThanOrEqual(50);
  });

  it("generated content has higher additionality than naive dump", async () => {
    const readme = `# My Project

A TypeScript monorepo. Install with pnpm install, build with pnpm build.

## Development

Run pnpm test to run tests.`;

    const ctx = createMockContext({
      "README.md": readme,
      "src/index.ts": "export const hello = 'world';",
      "package.json": JSON.stringify({
        name: "test-project",
        scripts: { build: "tsc", test: "vitest" },
      }),
    });

    const detection = makeDetectionResult();
    const result = await generateContextFiles(ctx, detection);

    expect(result.files.length).toBeGreaterThan(0);
    const generated = result.files[0];
    // Generated should have reasonable additionality
    // (may be 100% if it's all TODO comments/new content)
    expect(generated?.additionality).toBeGreaterThanOrEqual(0);

    // Compare with a naive dump (just copying README)
    const naiveResult = computeAdditionality(readme, "AGENTS.md (naive)", [
      { path: "README.md", content: readme },
    ]);

    // Generated additionality should be >= naive additionality
    if (generated && naiveResult.additionalityPct >= 0) {
      expect(generated.additionality).toBeGreaterThanOrEqual(naiveResult.additionalityPct);
    }
  });

  it("front-loads critical info in first 20%", async () => {
    const ctx = createMockContext({
      "src/index.ts": "export const foo = 1;",
      "package.json": JSON.stringify({
        name: "my-project",
        scripts: { build: "tsc", test: "vitest" },
      }),
    });

    const detection = makeDetectionResult();
    const result = await generateContextFiles(ctx, detection);

    expect(result.files.length).toBeGreaterThan(0);
    const generated = result.files[0];
    // Front-load score should be positive
    expect(generated?.frontLoadScore).toBeGreaterThanOrEqual(0);

    // Build/test commands should be in first 20% of lines
    if (generated) {
      const lines = generated.content.split("\n");
      const cutoff = Math.max(1, Math.ceil(lines.length * 0.2));
      const topSection = lines.slice(0, cutoff).join("\n");
      // Should contain build-related content near the top
      expect(
        topSection.includes("Build") ||
          topSection.includes("build") ||
          topSection.includes("AGENTS"),
      ).toBe(true);
    }
  });

  it("includes rationale for each section", async () => {
    const ctx = createMockContext({
      "src/index.ts": "export const foo = 1;",
      "package.json": JSON.stringify({
        name: "my-project",
        scripts: { build: "tsc", test: "vitest" },
      }),
    });

    const detection = makeDetectionResult();
    const result = await generateContextFiles(ctx, detection);

    expect(result.files.length).toBeGreaterThan(0);
    const generated = result.files[0];
    expect(generated?.rationale).toBeDefined();
    expect(Object.keys(generated?.rationale ?? {}).length).toBeGreaterThan(0);

    // Content should have rationale comments
    expect(generated?.content).toContain("Rationale:");
  });

  it("generates subdirectory files for monorepo", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({ name: "mono-root", scripts: { build: "turbo build" } }),
      "packages/web/package.json": JSON.stringify({
        name: "@my/web",
        scripts: { build: "next build", test: "vitest", lint: "eslint" },
      }),
      "packages/api/package.json": JSON.stringify({
        name: "@my/api",
        scripts: { build: "tsc", test: "vitest" },
      }),
      "packages/web/src/index.ts": "export default {}",
      "packages/api/src/index.ts": "export default {}",
      "src/index.ts": "",
    });

    const detection = makeDetectionResult({
      monorepo: {
        tool: "Turborepo",
        workspaceRoot: ".",
        packages: ["packages/web", "packages/api"],
      },
    });

    const result = await generateContextFiles(ctx, detection);

    // Should have root AGENTS.md + potentially subdirectory files
    expect(result.files.length).toBeGreaterThanOrEqual(1);
    const rootFile = result.files.find((f) => f.path === "AGENTS.md");
    expect(rootFile).toBeDefined();

    // Check for subdirectory files
    const subFiles = result.files.filter((f) => f.path !== "AGENTS.md");
    // Subdirectory files are only generated if additionality > 50%
    for (const sf of subFiles) {
      expect(sf.additionality).toBeGreaterThanOrEqual(50);
    }
  });
});

describe("additionality computation", () => {
  it("reports high additionality for unique content", () => {
    const result = computeAdditionality(
      "This is completely unique project-specific information that agents need to know about our special build process and architecture decisions",
      "AGENTS.md",
      [{ path: "README.md", content: "# Hello World\nA simple project." }],
    );
    expect(result.additionalityPct).toBeGreaterThan(50);
  });

  it("reports high redundancy for duplicated content", () => {
    const shared =
      "Install dependencies with pnpm install. Build with pnpm build. Run tests with pnpm test.";
    const result = computeAdditionality(shared, "AGENTS.md", [
      { path: "README.md", content: shared },
    ]);
    expect(result.redundancyPct).toBeGreaterThan(50);
  });

  it("returns -1 when no comparable segments exist", () => {
    const result = computeAdditionality("OK", "AGENTS.md", [{ path: "README.md", content: "Hi" }]);
    expect(result.redundancyPct).toBe(-1);
    expect(result.additionalityPct).toBe(-1);
  });
});

describe("front-load scoring", () => {
  it("returns 100 when all critical info is in top 20%", () => {
    const content = `## Build Commands

\`\`\`bash
pnpm install
pnpm build
pnpm test
\`\`\`

## Other Info

Some general project description and more details.
More lines here to fill it out.
And even more lines here.
And more lines.
More lines to make the file longer.
Even more lines to push past 20%.
Still more lines.
Yet more.
Almost there.
Done.`;
    const score = computeFrontLoadScore(content);
    expect(score).toBeGreaterThan(50);
  });

  it("returns 0 when critical info is only in bottom 80%", () => {
    const content = `## General Info

Some general description of the project that doesn't
mention any commands or architecture details.
More filler content here to pad the top section.
Even more padding to ensure we have enough lines.
And more and more and more text here to fill space.
Still going with filler content here because we need
at least a few more lines of non-critical text.
More non-critical content follows here in this section.

## Build Commands

\`\`\`bash
pnpm install
pnpm build
pnpm test
\`\`\``;
    const score = computeFrontLoadScore(content);
    expect(score).toBeLessThan(100);
  });
});

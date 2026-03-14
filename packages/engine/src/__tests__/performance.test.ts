import { describe, it, expect } from "vitest";
import type { RepoContext } from "../analyzers/analyzer.interface.js";
import { ANALYZERS } from "../analyzers/registry.js";
import { aggregateResults } from "../scoring/composite.js";

/**
 * Performance test: P1.01 AC#4
 * Verifies that the scan engine completes within 60 seconds
 * on a mock repository with 100k files.
 */

/** Generate a mock RepoContext with N files across realistic directory structures. */
function createLargeRepoContext(fileCount: number): RepoContext {
  const files: string[] = [];
  const fileContents = new Map<string, string>();

  // Distribute files across realistic directory structures
  const dirs = [
    "src/components",
    "src/utils",
    "src/services",
    "src/hooks",
    "src/pages",
    "src/api",
    "src/models",
    "src/types",
    "lib/core",
    "lib/helpers",
    "tests/unit",
    "tests/integration",
    "docs",
    "scripts",
    "config",
  ];

  const extensions = [".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".css", ".yaml"];

  for (let i = 0; i < fileCount; i++) {
    const dir = dirs[i % dirs.length];
    const ext = extensions[i % extensions.length];
    const filePath = `${dir}/file-${i}${ext}`;
    files.push(filePath);
  }

  // Add key files that analyzers look for
  const keyFiles: Record<string, string> = {
    "package.json": JSON.stringify({
      name: "large-repo",
      scripts: { build: "tsc", test: "vitest", lint: "eslint ." },
      devDependencies: { typescript: "^5.7.0", vitest: "^3.0.0", eslint: "^9.0.0" },
    }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: { strict: true, target: "ES2022", module: "Node16" },
    }),
    "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
    "README.md": "# Large Repo\n\nA test repository.\n",
    "AGENTS.md":
      "# AGENTS.md\n\n## Build & Test\n\n```bash\npnpm install\npnpm build\npnpm test\n```\n\n## Constraints\n\n- Use strict TypeScript\n",
    ".gitignore": "node_modules/\ndist/\n",
  };

  for (const [path, content] of Object.entries(keyFiles)) {
    files.push(path);
    fileContents.set(path, content);
  }

  files.sort();

  return {
    rootPath: "/mock/large-repo",
    files: Object.freeze(files),
    async readFile(relativePath: string): Promise<string | null> {
      if (fileContents.has(relativePath)) {
        return fileContents.get(relativePath) ?? null;
      }
      // Return minimal content for source files
      if (relativePath.endsWith(".ts") || relativePath.endsWith(".tsx")) {
        return 'export const placeholder = "value";\n';
      }
      if (relativePath.endsWith(".json")) {
        return "{}";
      }
      if (relativePath.endsWith(".md")) {
        return "# File\n";
      }
      return null;
    },
    async fileExists(relativePath: string): Promise<boolean> {
      return files.includes(relativePath);
    },
    async readJson<T = unknown>(relativePath: string): Promise<T | null> {
      const content = fileContents.get(relativePath);
      if (!content) return null;
      try {
        return JSON.parse(content) as T;
      } catch {
        return null;
      }
    },
  };
}

describe("performance: 100k file repo", () => {
  it("completes all 8 analyzer passes within 60 seconds on 100k files", async () => {
    const context = createLargeRepoContext(100_000);
    expect(context.files.length).toBeGreaterThanOrEqual(100_000);

    const startTime = performance.now();

    // Run all analyzers (same as scan.ts pipeline)
    const supportChecks = await Promise.all(
      ANALYZERS.map(async (analyzer) => ({
        analyzer,
        supported: await analyzer.supports(context),
      })),
    );

    const pillarResults = await Promise.all(
      supportChecks
        .filter(({ supported }) => supported)
        .map(({ analyzer }) => analyzer.analyze(context)),
    );

    const result = aggregateResults(pillarResults, {
      version: "0.1.0",
      repoPath: "/mock/large-repo",
      duration: 0,
    });

    const elapsed = performance.now() - startTime;

    // P1.01 AC#4: must complete within 60 seconds
    expect(elapsed).toBeLessThan(60_000);

    // Sanity: all 8 pillars should produce results
    expect(pillarResults.length).toBe(8);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);

    // Log for visibility
    // eslint-disable-next-line no-console
    console.log(
      `Performance: 100k files scanned in ${Math.round(elapsed)}ms (${(elapsed / 1000).toFixed(1)}s)`,
    );
  }, 120_000); // Vitest timeout: 2 minutes (generous buffer)

  it("scales sub-linearly: 10k vs 100k should be less than 10x slower", async () => {
    const context10k = createLargeRepoContext(10_000);
    const context100k = createLargeRepoContext(100_000);

    // Time 10k
    const start10k = performance.now();
    const checks10k = await Promise.all(
      ANALYZERS.map(async (a) => ({ a, ok: await a.supports(context10k) })),
    );
    await Promise.all(checks10k.filter(({ ok }) => ok).map(({ a }) => a.analyze(context10k)));
    const time10k = performance.now() - start10k;

    // Time 100k
    const start100k = performance.now();
    const checks100k = await Promise.all(
      ANALYZERS.map(async (a) => ({ a, ok: await a.supports(context100k) })),
    );
    await Promise.all(checks100k.filter(({ ok }) => ok).map(({ a }) => a.analyze(context100k)));
    const time100k = performance.now() - start100k;

    // Should scale sub-linearly (< 10x for 10x more files)
    const ratio = time100k / time10k;
    expect(ratio).toBeLessThan(10);

    // eslint-disable-next-line no-console
    console.log(
      `Scaling: 10k=${Math.round(time10k)}ms, 100k=${Math.round(time100k)}ms, ratio=${ratio.toFixed(1)}x`,
    );
  }, 120_000);
});

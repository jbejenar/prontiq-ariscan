import { describe, it, expect } from "vitest";
import { generateFixProposals } from "../../fix/generators.js";
import type { RepoContext } from "../../analyzers/analyzer.interface.js";
import type { DetectionResult } from "@prontiq/ariscan-schema";

function createMockContext(
  fileMap: Record<string, string>,
  extraFiles: string[] = [],
): RepoContext {
  const allFiles = [...Object.keys(fileMap), ...extraFiles].sort();
  return {
    rootPath: "/mock/repo",
    files: Object.freeze(allFiles),
    async readFile(path: string) {
      return fileMap[path] ?? null;
    },
    async fileExists(path: string) {
      return path in fileMap || extraFiles.includes(path);
    },
    async readJson<T = unknown>(path: string): Promise<T | null> {
      const content = fileMap[path];
      if (!content) return null;
      try {
        return JSON.parse(content) as T;
      } catch {
        return null;
      }
    },
  };
}

const nodeDetection: DetectionResult = {
  languages: [{ language: "typescript", confidence: 0.9, primary: true }],
  frameworks: [{ framework: "express", confidence: 0.8 }],
  monorepo: null,
};

const pythonDetection: DetectionResult = {
  languages: [{ language: "python", confidence: 0.9, primary: true }],
  frameworks: [],
  monorepo: null,
};

describe("generateFixProposals", () => {
  it("proposes all fix files for empty TS repo with lint+typecheck", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({
        name: "test",
        scripts: { build: "tsc", test: "vitest", lint: "eslint .", typecheck: "tsc --noEmit" },
      }),
    });

    const proposals = await generateFixProposals(ctx, nodeDetection);

    expect(proposals.length).toBe(8);
    const paths = proposals.map((p) => p.path);
    expect(paths).toContain("AGENTS.md");
    expect(paths).toContain(".agentignore");
    expect(paths).toContain(".devcontainer/devcontainer.json");
    expect(paths).toContain("src/providers/storage.provider.ts");
    expect(paths).toContain("tsconfig.json");
    expect(paths).toContain(".nvmrc");
    expect(paths).toContain(".husky/pre-commit");
    expect(paths).toContain(".github/CODEOWNERS");
  });

  it("marks existing files as alreadyExists", async () => {
    const ctx = createMockContext({
      "AGENTS.md": "# Existing agents file",
      "package.json": JSON.stringify({ name: "test" }),
    });

    const proposals = await generateFixProposals(ctx, nodeDetection);

    const agentsMd = proposals.find((p) => p.path === "AGENTS.md");
    expect(agentsMd?.alreadyExists).toBe(true);

    const agentignore = proposals.find((p) => p.path === ".agentignore");
    expect(agentignore?.alreadyExists).toBe(false);
  });

  it("generates AGENTS.md with build/test commands from package.json", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({
        name: "test",
        scripts: { build: "tsc", test: "vitest", lint: "eslint ." },
      }),
      "pnpm-lock.yaml": "lockfileVersion: '9.0'",
    });

    const proposals = await generateFixProposals(ctx, nodeDetection);
    const agentsMd = proposals.find((p) => p.path === "AGENTS.md");

    expect(agentsMd).toBeDefined();
    expect(agentsMd?.content).toContain("pnpm build");
    expect(agentsMd?.content).toContain("pnpm test");
    expect(agentsMd?.content).toContain("pnpm lint");
    expect(agentsMd?.content).toContain("TODO");
  });

  it("generates AGENTS.md with TODO prompts referencing ARI criteria", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({ name: "test" }),
    });

    const proposals = await generateFixProposals(ctx, nodeDetection);
    const agentsMd = proposals.find((p) => p.path === "AGENTS.md");

    expect(agentsMd?.content).toContain("TODO(ARI-CTX-001)");
    expect(agentsMd?.content).toContain("TODO(ARI-CTX-002)");
    expect(agentsMd?.content).toContain("TODO(ARI-CTX-003)");
    expect(agentsMd?.content).toContain("TODO(ARI-TST-001)");
  });

  it("generates AGENTS.md with Do NOT section", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({ name: "test" }),
    });

    const proposals = await generateFixProposals(ctx, nodeDetection);
    const agentsMd = proposals.find((p) => p.path === "AGENTS.md");

    expect(agentsMd?.content).toContain("## Do NOT");
  });

  it("generates .agentignore with standard patterns", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({ name: "test" }),
    });

    const proposals = await generateFixProposals(ctx, nodeDetection);
    const agentignore = proposals.find((p) => p.path === ".agentignore");

    expect(agentignore).toBeDefined();
    expect(agentignore?.content).toContain("dist/");
    expect(agentignore?.content).toContain("node_modules/");
    expect(agentignore?.content).toContain("pnpm-lock.yaml");
    expect(agentignore?.content).toContain("coverage/");
  });

  it("generates .agentignore with Python-specific patterns", async () => {
    const ctx = createMockContext({
      "pyproject.toml": "[project]\nname = 'test'",
    });

    const proposals = await generateFixProposals(ctx, pythonDetection);
    const agentignore = proposals.find((p) => p.path === ".agentignore");

    expect(agentignore?.content).toContain("*.pyc");
    expect(agentignore?.content).toContain(".mypy_cache/");
  });

  it("generates devcontainer.json with correct image for TypeScript", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({ name: "test" }),
      "pnpm-lock.yaml": "lockfileVersion: '9.0'",
    });

    const proposals = await generateFixProposals(ctx, nodeDetection);
    const devcontainer = proposals.find((p) => p.path === ".devcontainer/devcontainer.json");

    expect(devcontainer).toBeDefined();
    const config = JSON.parse(devcontainer?.content ?? "{}");
    expect(config.image).toContain("typescript-node");
    expect(config.postCreateCommand).toContain("pnpm install");
    expect(config["// TODO(ARI-ENV-001)"]).toBeDefined();
  });

  it("generates devcontainer.json with correct image for Python", async () => {
    const ctx = createMockContext({
      "pyproject.toml": "[project]\nname = 'test'",
    });

    const proposals = await generateFixProposals(ctx, pythonDetection);
    const devcontainer = proposals.find((p) => p.path === ".devcontainer/devcontainer.json");

    const config = JSON.parse(devcontainer?.content ?? "{}");
    expect(config.image).toContain("python");
    expect(config.postCreateCommand).toContain("pip install");
  });

  it("each proposal has a rationale and criterion", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({ name: "test" }),
    });

    const proposals = await generateFixProposals(ctx, nodeDetection);

    for (const p of proposals) {
      expect(p.rationale.length).toBeGreaterThan(10);
      expect(p.criterion).toMatch(/^ARI-[A-Z]{3}-\d{3}$/);
    }
  });

  it("is idempotent — all proposals marked alreadyExists if files present", async () => {
    const ctx = createMockContext(
      {
        "AGENTS.md": "# exists",
        ".agentignore": "dist/",
        ".nvmrc": "22",
        "package.json": JSON.stringify({
          name: "test",
          scripts: { lint: "eslint .", typecheck: "tsc --noEmit" },
        }),
        "tsconfig.json": JSON.stringify({
          compilerOptions: {
            strict: true,
            noUncheckedIndexedAccess: true,
            exactOptionalPropertyTypes: true,
          },
        }),
      },
      [
        ".devcontainer/devcontainer.json",
        "src/providers/storage.provider.ts",
        ".husky/pre-commit",
        ".github/CODEOWNERS",
      ],
    );

    const proposals = await generateFixProposals(ctx, nodeDetection);
    // tsconfig is fully strict, so no tsconfig proposal is generated
    const nonTsconfigProposals = proposals.filter((p) => p.path !== "tsconfig.json");
    expect(nonTsconfigProposals.every((p) => p.alreadyExists)).toBe(true);
  });

  it("generates for repo with no package.json (Go project)", async () => {
    const goDetection: DetectionResult = {
      languages: [{ language: "go", confidence: 0.9, primary: true }],
      frameworks: [],
      monorepo: null,
    };
    const ctx = createMockContext({
      "go.mod": "module example.com/test",
    });

    const proposals = await generateFixProposals(ctx, goDetection);
    const agentsMd = proposals.find((p) => p.path === "AGENTS.md");
    expect(agentsMd?.content).toContain("go build");

    const devcontainer = proposals.find((p) => p.path === ".devcontainer/devcontainer.json");
    const config = JSON.parse(devcontainer?.content ?? "{}");
    expect(config.image).toContain("go");
    expect(config.postCreateCommand).toContain("go mod download");
  });

  it("includes detection metadata in AGENTS.md", async () => {
    const ctx = createMockContext({
      "package.json": JSON.stringify({ name: "test" }),
    });

    const proposals = await generateFixProposals(ctx, nodeDetection);
    const agentsMd = proposals.find((p) => p.path === "AGENTS.md");

    expect(agentsMd?.content).toContain("typescript");
    expect(agentsMd?.content).toContain("express");
  });

  describe("tsconfig strictness generator (P2.07)", () => {
    it("generates tsconfig.json for TS repo without one", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ name: "test" }),
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const tsconfig = proposals.find((p) => p.path === "tsconfig.json");

      expect(tsconfig).toBeDefined();
      expect(tsconfig?.alreadyExists).toBe(false);
      expect(tsconfig?.criterion).toBe("ARI-BLD-001");

      const parsed = JSON.parse(tsconfig?.content ?? "{}");
      expect(parsed.compilerOptions.strict).toBe(true);
      expect(parsed.compilerOptions.noUncheckedIndexedAccess).toBe(true);
    });

    it("suggests improvements for non-strict existing tsconfig", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ name: "test" }),
        "tsconfig.json": JSON.stringify({
          compilerOptions: { target: "ES2020", module: "commonjs" },
        }),
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const tsconfig = proposals.find((p) => p.path === "tsconfig.json");

      expect(tsconfig).toBeDefined();
      expect(tsconfig?.alreadyExists).toBe(true);
      expect(tsconfig?.rationale).toContain("strict");
      expect(tsconfig?.rationale).toContain("Do NOT auto-apply");
    });

    it("skips tsconfig fix when already fully strict", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ name: "test" }),
        "tsconfig.json": JSON.stringify({
          compilerOptions: {
            strict: true,
            noUncheckedIndexedAccess: true,
            exactOptionalPropertyTypes: true,
          },
        }),
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const tsconfig = proposals.find((p) => p.path === "tsconfig.json");
      expect(tsconfig).toBeUndefined();
    });

    it("skips tsconfig for non-TypeScript projects", async () => {
      const ctx = createMockContext({
        "pyproject.toml": "[project]\nname = 'test'",
      });

      const proposals = await generateFixProposals(ctx, pythonDetection);
      const tsconfig = proposals.find((p) => p.path === "tsconfig.json");
      expect(tsconfig).toBeUndefined();
    });

    it("handles unparseable tsconfig gracefully", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ name: "test" }),
        "tsconfig.json": "{ invalid json",
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const tsconfig = proposals.find((p) => p.path === "tsconfig.json");

      expect(tsconfig).toBeDefined();
      expect(tsconfig?.alreadyExists).toBe(true);
      expect(tsconfig?.rationale).toContain("could not be parsed");
    });
  });

  describe(".nvmrc generator (P2.07)", () => {
    it("generates .nvmrc for TS repo without one", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ name: "test" }),
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const nvmrc = proposals.find((p) => p.path === ".nvmrc");

      expect(nvmrc).toBeDefined();
      expect(nvmrc?.alreadyExists).toBe(false);
      expect(nvmrc?.criterion).toBe("ARI-ENV-003");
      expect(nvmrc?.confidence).toBe("high");
      expect(nvmrc?.content.trim()).toBe("22");
    });

    it("reads Node version from engines field", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({
          name: "test",
          engines: { node: ">=20.0.0" },
        }),
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const nvmrc = proposals.find((p) => p.path === ".nvmrc");

      expect(nvmrc?.content.trim()).toBe("20");
    });

    it("marks alreadyExists if .nvmrc present", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ name: "test" }),
        ".nvmrc": "20",
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const nvmrc = proposals.find((p) => p.path === ".nvmrc");

      expect(nvmrc?.alreadyExists).toBe(true);
    });

    it("marks alreadyExists if .node-version present", async () => {
      const ctx = createMockContext({ "package.json": JSON.stringify({ name: "test" }) }, [
        ".node-version",
      ]);

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const nvmrc = proposals.find((p) => p.path === ".nvmrc");

      expect(nvmrc?.alreadyExists).toBe(true);
    });

    it("skips .nvmrc for Python projects", async () => {
      const ctx = createMockContext({
        "pyproject.toml": "[project]\nname = 'test'",
      });

      const proposals = await generateFixProposals(ctx, pythonDetection);
      const nvmrc = proposals.find((p) => p.path === ".nvmrc");

      expect(nvmrc).toBeUndefined();
    });
  });

  describe("pre-commit hooks generator (P2.07)", () => {
    it("generates .husky/pre-commit for TS repo with lint+typecheck", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({
          name: "test",
          scripts: { lint: "eslint .", typecheck: "tsc --noEmit" },
        }),
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const preCommit = proposals.find((p) => p.path === ".husky/pre-commit");

      expect(preCommit).toBeDefined();
      expect(preCommit?.alreadyExists).toBe(false);
      expect(preCommit?.criterion).toBe("ARI-SEC-003");
      expect(preCommit?.confidence).toBe("medium");
      expect(preCommit?.content).toContain("npm lint");
      expect(preCommit?.content).toContain("npm typecheck");
      expect(preCommit?.content).toContain("#!/usr/bin/env sh");
    });

    it("uses pnpm when pnpm lockfile present", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({
          name: "test",
          scripts: { lint: "eslint ." },
        }),
        "pnpm-lock.yaml": "lockfileVersion: '9.0'",
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const preCommit = proposals.find((p) => p.path === ".husky/pre-commit");

      expect(preCommit?.content).toContain("pnpm lint");
    });

    it("skips when no lint or typecheck scripts", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({
          name: "test",
          scripts: { build: "tsc", test: "vitest" },
        }),
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const preCommit = proposals.find((p) => p.path === ".husky/pre-commit");

      expect(preCommit).toBeUndefined();
    });

    it("marks alreadyExists if .husky/pre-commit present", async () => {
      const ctx = createMockContext(
        {
          "package.json": JSON.stringify({
            name: "test",
            scripts: { lint: "eslint ." },
          }),
        },
        [".husky/pre-commit"],
      );

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const preCommit = proposals.find((p) => p.path === ".husky/pre-commit");

      expect(preCommit?.alreadyExists).toBe(true);
    });

    it("skips for Python projects", async () => {
      const ctx = createMockContext({
        "pyproject.toml": "[project]\nname = 'test'",
      });

      const proposals = await generateFixProposals(ctx, pythonDetection);
      const preCommit = proposals.find((p) => p.path === ".husky/pre-commit");

      expect(preCommit).toBeUndefined();
    });
  });

  describe("CODEOWNERS generator (P2.07)", () => {
    it("generates .github/CODEOWNERS for repo without one", async () => {
      const ctx = createMockContext(
        {
          "package.json": JSON.stringify({ name: "test" }),
        },
        ["src/index.ts"],
      );

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const codeowners = proposals.find((p) => p.path === ".github/CODEOWNERS");

      expect(codeowners).toBeDefined();
      expect(codeowners?.alreadyExists).toBe(false);
      expect(codeowners?.criterion).toBe("ARI-SEC-001");
      expect(codeowners?.confidence).toBe("low");
      expect(codeowners?.content).toContain("@TODO-add-default-owner");
      expect(codeowners?.content).toContain("src/");
    });

    it("marks alreadyExists if CODEOWNERS in root", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ name: "test" }),
        CODEOWNERS: "* @team",
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const codeowners = proposals.find((p) => p.path === ".github/CODEOWNERS");

      expect(codeowners?.alreadyExists).toBe(true);
    });

    it("marks alreadyExists if CODEOWNERS in .github/", async () => {
      const ctx = createMockContext({ "package.json": JSON.stringify({ name: "test" }) }, [
        ".github/CODEOWNERS",
      ]);

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const codeowners = proposals.find((p) => p.path === ".github/CODEOWNERS");

      expect(codeowners?.alreadyExists).toBe(true);
    });

    it("includes packages/ section for monorepo-like repos", async () => {
      const ctx = createMockContext({ "package.json": JSON.stringify({ name: "test" }) }, [
        "packages/core/index.ts",
      ]);

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const codeowners = proposals.find((p) => p.path === ".github/CODEOWNERS");

      expect(codeowners?.content).toContain("packages/");
    });
  });

  describe("confidence field (P2.07)", () => {
    it("every proposal has a valid confidence field", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({
          name: "test",
          scripts: { lint: "eslint .", typecheck: "tsc --noEmit" },
        }),
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);

      for (const p of proposals) {
        expect(["high", "medium", "low"]).toContain(p.confidence);
      }
    });

    it("file-creation proposals have high confidence for core generators", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ name: "test" }),
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const agentsMd = proposals.find((p) => p.path === "AGENTS.md");
      const agentignore = proposals.find((p) => p.path === ".agentignore");
      const devcontainer = proposals.find((p) => p.path === ".devcontainer/devcontainer.json");

      expect(agentsMd?.confidence).toBe("high");
      expect(agentignore?.confidence).toBe("high");
      expect(devcontainer?.confidence).toBe("high");
    });

    it("provider skeleton has medium confidence", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ name: "test" }),
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const provider = proposals.find((p) => p.path === "src/providers/storage.provider.ts");

      expect(provider?.confidence).toBe("medium");
    });

    it("CODEOWNERS has low confidence", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ name: "test" }),
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const codeowners = proposals.find((p) => p.path === ".github/CODEOWNERS");

      expect(codeowners?.confidence).toBe("low");
    });
  });
});

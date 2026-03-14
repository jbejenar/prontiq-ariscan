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

    expect(proposals.length).toBeGreaterThanOrEqual(9);
    const paths = proposals.map((p) => p.path);
    expect(paths).toContain("AGENTS.md");
    expect(paths).toContain(".agentignore");
    expect(paths).toContain(".devcontainer/devcontainer.json");
    expect(paths).toContain("src/providers/storage.provider.ts");
    expect(paths).toContain("tsconfig.json");
    expect(paths).toContain(".nvmrc");
    expect(paths).toContain(".husky/pre-commit");
    expect(paths).toContain(".github/CODEOWNERS");
    expect(paths).toContain("docs/decisions/000-template.md");
    expect(paths).toContain("CHANGELOG.md");
    expect(paths).toContain(".gitleaks.toml");
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
        "CHANGELOG.md": "# Changelog",
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
        ".github/pull_request_template.md",
        ".gitleaks.toml",
        ".env.example",
        "docs/decisions/001-something.md",
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

  describe("env var documentation generator (P2.07)", () => {
    it("generates .env.example from process.env usage", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ name: "test" }),
        "src/config.ts": `
          const port = process.env.PORT || 3000;
          const dbUrl = process.env.DATABASE_URL;
          const secret = process.env.JWT_SECRET;
        `,
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const envDoc = proposals.find((p) => p.path === ".env.example");

      expect(envDoc).toBeDefined();
      expect(envDoc?.alreadyExists).toBe(false);
      expect(envDoc?.criterion).toBe("ARI-ENV-007");
      expect(envDoc?.confidence).toBe("medium");
      expect(envDoc?.content).toContain("PORT");
      expect(envDoc?.content).toContain("DATABASE_URL");
      expect(envDoc?.content).toContain("JWT_SECRET");
    });

    it("detects default values for env vars", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ name: "test" }),
        "src/app.ts": `
          const port = process.env.PORT || "3000";
          const host = process.env.HOST ?? "localhost";
          const required = process.env.API_KEY;
        `,
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const envDoc = proposals.find((p) => p.path === ".env.example");

      expect(envDoc).toBeDefined();
      // PORT and HOST have defaults (optional section), API_KEY doesn't (required section)
      expect(envDoc?.content).toContain("Required");
      expect(envDoc?.content).toContain("Optional");
      expect(envDoc?.content).toContain("API_KEY");
    });

    it("marks alreadyExists when .env.example present", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ name: "test" }),
        ".env.example": "PORT=3000",
        "src/app.ts": "const p = process.env.PORT;",
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const envDoc = proposals.find((p) => p.path === ".env.example");

      expect(envDoc?.alreadyExists).toBe(true);
    });

    it("skips when no env vars found", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ name: "test" }),
        "src/app.ts": "const x = 42;",
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const envDoc = proposals.find((p) => p.path === ".env.example");

      expect(envDoc).toBeUndefined();
    });

    it("includes file references in comments", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ name: "test" }),
        "src/db.ts": "const url = process.env.DATABASE_URL;",
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const envDoc = proposals.find((p) => p.path === ".env.example");

      expect(envDoc?.content).toContain("src/db.ts");
    });
  });

  describe("ADR template generator (P2.06)", () => {
    it("generates ADR template for repo without one", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ name: "test" }),
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const adr = proposals.find((p) => p.path === "docs/decisions/000-template.md");

      expect(adr).toBeDefined();
      expect(adr?.alreadyExists).toBe(false);
      expect(adr?.criterion).toBe("ARI-DOC-002");
      expect(adr?.confidence).toBe("medium");
      expect(adr?.content).toContain("## Status");
      expect(adr?.content).toContain("## Context");
      expect(adr?.content).toContain("## Decision");
      expect(adr?.content).toContain("## Consequences");
      expect(adr?.content).toContain("## Alternatives Considered");
    });

    it("marks alreadyExists when docs/decisions/ directory exists", async () => {
      const ctx = createMockContext({ "package.json": JSON.stringify({ name: "test" }) }, [
        "docs/decisions/001-use-react.md",
      ]);

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const adr = proposals.find((p) => p.path === "docs/decisions/000-template.md");

      expect(adr?.alreadyExists).toBe(true);
    });

    it("marks alreadyExists when docs/adr/ directory exists", async () => {
      const ctx = createMockContext({ "package.json": JSON.stringify({ name: "test" }) }, [
        "docs/adr/001-something.md",
      ]);

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const adr = proposals.find((p) => p.path === "docs/decisions/000-template.md");

      expect(adr?.alreadyExists).toBe(true);
    });
  });

  describe("changelog template generator (P2.06)", () => {
    it("generates CHANGELOG.md for repo without one", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ name: "test" }),
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const changelog = proposals.find((p) => p.path === "CHANGELOG.md");

      expect(changelog).toBeDefined();
      expect(changelog?.alreadyExists).toBe(false);
      expect(changelog?.criterion).toBe("ARI-DOC-002");
      expect(changelog?.confidence).toBe("high");
      expect(changelog?.content).toContain("Keep a Changelog");
      expect(changelog?.content).toContain("## [Unreleased]");
      expect(changelog?.content).toContain("### Added");
    });

    it("marks alreadyExists when CHANGELOG.md present", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ name: "test" }),
        "CHANGELOG.md": "# Changelog\n\n## 1.0.0",
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const changelog = proposals.find((p) => p.path === "CHANGELOG.md");

      expect(changelog?.alreadyExists).toBe(true);
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

  describe("docker-compose generator", () => {
    it("generates docker-compose.yml when postgres dep is detected", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({
          name: "test",
          dependencies: { pg: "^8.0.0" },
        }),
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const compose = proposals.find((p) => p.path === "docker-compose.yml");

      expect(compose).toBeDefined();
      expect(compose?.alreadyExists).toBe(false);
      expect(compose?.confidence).toBe("medium");
      expect(compose?.content).toContain("postgres");
      expect(compose?.content).toContain("postgres:16-alpine");
      expect(compose?.content).toContain("5432");
      expect(compose?.content).toContain("POSTGRES_DB=app_dev");
    });

    it("generates docker-compose.yml with redis when ioredis is used", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({
          name: "test",
          dependencies: { ioredis: "^5.0.0" },
        }),
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const compose = proposals.find((p) => p.path === "docker-compose.yml");

      expect(compose).toBeDefined();
      expect(compose?.content).toContain("redis:7-alpine");
      expect(compose?.content).toContain("6379");
    });

    it("generates multiple services when multiple deps are detected", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({
          name: "test",
          dependencies: { pg: "^8.0.0", ioredis: "^5.0.0", amqplib: "^0.10.0" },
        }),
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const compose = proposals.find((p) => p.path === "docker-compose.yml");

      expect(compose?.content).toContain("postgres:");
      expect(compose?.content).toContain("redis:");
      expect(compose?.content).toContain("rabbitmq:");
    });

    it("skips docker-compose when no service deps are found", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ name: "test" }),
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const compose = proposals.find((p) => p.path === "docker-compose.yml");

      expect(compose).toBeUndefined();
    });

    it("marks as alreadyExists when docker-compose.yml exists", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({
          name: "test",
          dependencies: { pg: "^8.0.0" },
        }),
        "docker-compose.yml": "services: {}",
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const compose = proposals.find((p) => p.path === "docker-compose.yml");

      expect(compose?.alreadyExists).toBe(true);
    });

    it("marks as alreadyExists when compose.yml exists", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({
          name: "test",
          dependencies: { pg: "^8.0.0" },
        }),
        "compose.yml": "services: {}",
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const compose = proposals.find((p) => p.path === "docker-compose.yml");

      expect(compose?.alreadyExists).toBe(true);
    });

    it("detects Python service deps from requirements.txt", async () => {
      const ctx = createMockContext({
        "requirements.txt": "psycopg2-binary>=2.9\naioredis>=2.0",
      });

      const proposals = await generateFixProposals(ctx, pythonDetection);
      const compose = proposals.find((p) => p.path === "docker-compose.yml");

      expect(compose).toBeDefined();
      expect(compose?.content).toContain("postgres:");
      expect(compose?.content).toContain("redis:");
    });

    it("generates named volumes section for services with persistent storage", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({
          name: "test",
          dependencies: { pg: "^8.0.0" },
        }),
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const compose = proposals.find((p) => p.path === "docker-compose.yml");

      expect(compose?.content).toContain("volumes:");
      expect(compose?.content).toContain("pgdata:");
    });

    it("includes healthchecks for all generated services", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({
          name: "test",
          dependencies: { pg: "^8.0.0", ioredis: "^5.0.0" },
        }),
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const compose = proposals.find((p) => p.path === "docker-compose.yml");

      expect(compose?.content).toContain("healthcheck:");
      expect(compose?.content).toContain("pg_isready");
      expect(compose?.content).toContain("redis-cli");
    });

    it("detects MySQL from mysql2 dependency", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({
          name: "test",
          dependencies: { mysql2: "^3.0.0" },
        }),
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const compose = proposals.find((p) => p.path === "docker-compose.yml");

      expect(compose).toBeDefined();
      expect(compose?.content).toContain("mysql:");
      expect(compose?.content).toContain("mysql:8.0");
      expect(compose?.content).toContain("3306");
      expect(compose?.content).toContain("MYSQL_DATABASE=app_dev");
    });

    it("detects MongoDB from mongoose dependency", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({
          name: "test",
          dependencies: { mongoose: "^8.0.0" },
        }),
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const compose = proposals.find((p) => p.path === "docker-compose.yml");

      expect(compose).toBeDefined();
      expect(compose?.content).toContain("mongo:");
      expect(compose?.content).toContain("mongo:7");
      expect(compose?.content).toContain("27017");
    });

    it("generates environment entries with list syntax (- prefix)", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({
          name: "test",
          dependencies: { pg: "^8.0.0" },
        }),
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const compose = proposals.find((p) => p.path === "docker-compose.yml");

      expect(compose?.content).toContain("      - POSTGRES_USER=dev");
    });
  });

  describe("PR template generator", () => {
    it("generates PR template for repos with .github directory", async () => {
      const ctx = createMockContext(
        {
          "package.json": JSON.stringify({ name: "test" }),
        },
        [".github/workflows/ci.yml"],
      );

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const pr = proposals.find((p) => p.path === ".github/pull_request_template.md");

      expect(pr).toBeDefined();
      expect(pr?.alreadyExists).toBe(false);
      expect(pr?.confidence).toBe("medium");
    });

    it("includes AI-code review checklist in PR template", async () => {
      const ctx = createMockContext(
        {
          "package.json": JSON.stringify({ name: "test" }),
        },
        [".github/workflows/ci.yml"],
      );

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const pr = proposals.find((p) => p.path === ".github/pull_request_template.md");

      expect(pr?.content).toContain("AI-Code Review Checklist");
      expect(pr?.content).toContain("reviewed line-by-line");
      expect(pr?.content).toContain("hallucinated imports");
      expect(pr?.content).toContain("secrets, credentials");
      expect(pr?.content).toContain("License compatibility");
    });

    it("includes summary, changes, test plan, and rollback sections", async () => {
      const ctx = createMockContext(
        {
          "package.json": JSON.stringify({ name: "test" }),
        },
        [".github/workflows/ci.yml"],
      );

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const pr = proposals.find((p) => p.path === ".github/pull_request_template.md");

      expect(pr?.content).toContain("## Summary");
      expect(pr?.content).toContain("## Changes");
      expect(pr?.content).toContain("## Test Plan");
      expect(pr?.content).toContain("## Rollback Plan");
    });

    it("marks as alreadyExists when PR template exists", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ name: "test" }),
        ".github/pull_request_template.md": "# PR Template",
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const pr = proposals.find((p) => p.path === ".github/pull_request_template.md");

      expect(pr?.alreadyExists).toBe(true);
    });

    it("marks as alreadyExists when PULL_REQUEST_TEMPLATE.md exists", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ name: "test" }),
        ".github/PULL_REQUEST_TEMPLATE.md": "# PR Template",
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const pr = proposals.find((p) => p.path === ".github/pull_request_template.md");

      expect(pr?.alreadyExists).toBe(true);
    });

    it("generates PR template even when no .github dir exists yet", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ name: "test" }),
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const pr = proposals.find((p) => p.path === ".github/pull_request_template.md");

      expect(pr).toBeDefined();
      expect(pr?.alreadyExists).toBe(false);
    });
  });

  describe("DI wiring example generator", () => {
    it("generates NestJS DI example for nestjs framework", async () => {
      const nestDetection: DetectionResult = {
        languages: [{ language: "typescript", confidence: 0.9, primary: true }],
        frameworks: [{ framework: "nestjs", confidence: 0.8 }],
        monorepo: null,
      };

      const ctx = createMockContext({
        "package.json": JSON.stringify({ name: "test" }),
      });

      const proposals = await generateFixProposals(ctx, nestDetection);
      const di = proposals.find((p) => p.path === "src/providers/storage.module.example.ts");

      expect(di).toBeDefined();
      expect(di?.confidence).toBe("low");
      expect(di?.content).toContain("@Module");
      expect(di?.content).toContain("STORAGE_PROVIDER");
      expect(di?.content).toContain("InMemoryStorageProvider");
    });

    it("generates FastAPI DI example for python/fastapi", async () => {
      const fastapiDetection: DetectionResult = {
        languages: [{ language: "python", confidence: 0.9, primary: true }],
        frameworks: [{ framework: "fastapi", confidence: 0.8 }],
        monorepo: null,
      };

      const ctx = createMockContext({});

      const proposals = await generateFixProposals(ctx, fastapiDetection);
      const di = proposals.find((p) => p.path === "src/providers/storage_provider.example.py");

      expect(di).toBeDefined();
      expect(di?.confidence).toBe("low");
      expect(di?.content).toContain("FastAPI");
      expect(di?.content).toContain("Depends");
      expect(di?.content).toContain("dependency_overrides");
    });

    it("generates Spring Boot DI example for java/spring-boot", async () => {
      const springDetection: DetectionResult = {
        languages: [{ language: "java", confidence: 0.9, primary: true }],
        frameworks: [{ framework: "spring-boot", confidence: 0.8 }],
        monorepo: null,
      };

      const ctx = createMockContext({});

      const proposals = await generateFixProposals(ctx, springDetection);
      const di = proposals.find(
        (p) => p.path === "src/main/java/providers/StorageProviderExample.java",
      );

      expect(di).toBeDefined();
      expect(di?.confidence).toBe("low");
      expect(di?.content).toContain("@Profile");
      expect(di?.content).toContain("@Service");
      expect(di?.content).toContain("InMemoryStorageProvider");
    });

    it("generates Go DI example for go projects", async () => {
      const goDetection: DetectionResult = {
        languages: [{ language: "go", confidence: 0.9, primary: true }],
        frameworks: [],
        monorepo: null,
      };

      const ctx = createMockContext({});

      const proposals = await generateFixProposals(ctx, goDetection);
      const di = proposals.find((p) => p.path === "internal/providers/storage_provider_example.go");

      expect(di).toBeDefined();
      expect(di?.confidence).toBe("low");
      expect(di?.content).toContain("StorageProvider interface");
      expect(di?.content).toContain("InMemoryStorage");
      expect(di?.content).toContain("sync.RWMutex");
    });

    it("skips DI example when framework has no known DI pattern", async () => {
      const expressDetection: DetectionResult = {
        languages: [{ language: "typescript", confidence: 0.9, primary: true }],
        frameworks: [{ framework: "express", confidence: 0.8 }],
        monorepo: null,
      };

      const ctx = createMockContext({
        "package.json": JSON.stringify({ name: "test" }),
      });

      const proposals = await generateFixProposals(ctx, expressDetection);
      const diPaths = proposals.filter((p) => p.path.includes("example"));

      // Express doesn't have a DI wiring example
      expect(diPaths.length).toBe(0);
    });

    it("marks as alreadyExists when DI example file already exists", async () => {
      const nestDetection: DetectionResult = {
        languages: [{ language: "typescript", confidence: 0.9, primary: true }],
        frameworks: [{ framework: "nestjs", confidence: 0.8 }],
        monorepo: null,
      };

      const ctx = createMockContext({
        "package.json": JSON.stringify({ name: "test" }),
        "src/providers/storage.module.example.ts": "// existing",
      });

      const proposals = await generateFixProposals(ctx, nestDetection);
      const di = proposals.find((p) => p.path === "src/providers/storage.module.example.ts");

      expect(di?.alreadyExists).toBe(true);
    });
  });

  describe("gitleaks config generator", () => {
    it("generates .gitleaks.toml for repos without secrets scanning", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ name: "test" }),
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const gitleaks = proposals.find((p) => p.path === ".gitleaks.toml");

      expect(gitleaks).toBeDefined();
      expect(gitleaks?.alreadyExists).toBe(false);
      expect(gitleaks?.confidence).toBe("high");
      expect(gitleaks?.content).toContain("[allowlist]");
      expect(gitleaks?.content).toContain("node_modules");
    });

    it("marks as alreadyExists when .gitleaks.toml exists", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ name: "test" }),
        ".gitleaks.toml": "[allowlist]",
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const gitleaks = proposals.find((p) => p.path === ".gitleaks.toml");

      expect(gitleaks?.alreadyExists).toBe(true);
    });

    it("marks as alreadyExists when .trufflehog.yml exists", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ name: "test" }),
        ".trufflehog.yml": "detectors: []",
      });

      const proposals = await generateFixProposals(ctx, nodeDetection);
      const gitleaks = proposals.find((p) => p.path === ".gitleaks.toml");

      expect(gitleaks?.alreadyExists).toBe(true);
    });
  });
});

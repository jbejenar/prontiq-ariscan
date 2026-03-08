import { type PillarId, PILLAR_NAMES, PILLAR_WEIGHTS, type Finding } from "@prontiq/schema";
import type { PillarAnalyzer, RepoContext } from "./analyzer.interface.js";

const PILLAR: PillarId = "P6";

export const buildDeterminismAnalyzer: PillarAnalyzer = {
  pillar: PILLAR,
  name: PILLAR_NAMES[PILLAR],
  version: "0.1.0",

  async supports(): Promise<boolean> {
    return true;
  },

  async analyze(context: RepoContext) {
    const findings: Finding[] = [];
    let score = 0;

    // TypeScript strict mode
    const tsconfig = await context.readJson<Record<string, unknown>>("tsconfig.json");
    if (tsconfig) {
      const compilerOptions = (tsconfig["compilerOptions"] ?? {}) as Record<string, unknown>;
      const isStrict = compilerOptions["strict"] === true;
      const hasStrictNullChecks = compilerOptions["strictNullChecks"] === true;
      const hasNoImplicitAny = compilerOptions["noImplicitAny"] === true;

      if (isStrict) {
        score += 30;
      } else if (hasStrictNullChecks && hasNoImplicitAny) {
        score += 20;
      } else if (hasStrictNullChecks || hasNoImplicitAny) {
        score += 10;
        findings.push({
          code: "ARI-BLD-001",
          severity: "high",
          pillar: PILLAR,
          message: "TypeScript strict mode is not fully enabled",
          remediation: {
            action: "modify-config",
            path: "tsconfig.json",
            description: "Enable 'strict: true' in tsconfig.json compilerOptions",
            estimatedImpact: "+5 points composite",
            confidence: "high",
          },
          evidence: {
            paper: "GitHub Octoverse, 2025",
            finding: "94% of LLM compilation errors are type-check failures",
            confidence: "high",
          },
        });
      } else {
        findings.push({
          code: "ARI-BLD-001",
          severity: "high",
          pillar: PILLAR,
          message: "TypeScript strict mode is not enabled",
          remediation: {
            action: "modify-config",
            path: "tsconfig.json",
            description: "Enable 'strict: true' in tsconfig.json compilerOptions",
            estimatedImpact: "+5 points composite",
            confidence: "high",
          },
          evidence: {
            paper: "GitHub Octoverse, 2025",
            finding: "94% of LLM compilation errors are type-check failures",
            confidence: "high",
          },
        });
      }

      // isolatedModules
      if (compilerOptions["isolatedModules"] === true) {
        score += 5;
      }
    } else {
      // Check for Python type checking
      const hasPyproject = await context.fileExists("pyproject.toml");
      const hasMypy = await context.fileExists("mypy.ini") || await context.fileExists(".mypy.ini");
      const hasPyrightConfig = await context.fileExists("pyrightconfig.json");

      if (hasMypy || hasPyrightConfig) {
        score += 20;
      } else if (hasPyproject) {
        const pyproject = await context.readFile("pyproject.toml");
        if (pyproject && /\[tool\.mypy\]|\[tool\.pyright\]/i.test(pyproject)) {
          score += 20;
        }
      }

      // Check for Go (inherently typed)
      const hasGoMod = await context.fileExists("go.mod");
      if (hasGoMod) {
        score += 25;
      }

      // Rust (inherently typed + strict)
      const hasCargo = await context.fileExists("Cargo.toml");
      if (hasCargo) {
        score += 30;
      }
    }

    // Lockfile presence
    const lockfiles = [
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock",
      "bun.lockb",
      "poetry.lock",
      "Pipfile.lock",
      "go.sum",
      "Cargo.lock",
      "Gemfile.lock",
      "composer.lock",
    ];
    let hasLockfile = false;
    for (const lf of lockfiles) {
      if (await context.fileExists(lf)) {
        hasLockfile = true;
        break;
      }
    }

    if (hasLockfile) {
      score += 20;
    } else {
      // Check if lockfile is gitignored (bad practice)
      const gitignore = await context.readFile(".gitignore");
      const lockfileIgnored = gitignore && lockfiles.some((lf) => gitignore.includes(lf));

      if (lockfileIgnored) {
        findings.push({
          code: "ARI-BLD-002",
          severity: "high",
          pillar: PILLAR,
          message: "Lockfile is gitignored — builds are non-deterministic",
          remediation: {
            action: "modify-config",
            path: ".gitignore",
            description: "Remove lockfile from .gitignore and commit it",
            confidence: "high",
          },
        });
      } else {
        findings.push({
          code: "ARI-BLD-003",
          severity: "medium",
          pillar: PILLAR,
          message: "No lockfile found",
          remediation: {
            action: "add-dependency",
            description: "Run your package manager to generate a lockfile and commit it",
            confidence: "high",
          },
        });
      }
    }

    // Build command present
    const pkg = await context.readJson<Record<string, unknown>>("package.json");
    const scripts = (pkg?.["scripts"] ?? {}) as Record<string, string>;
    if (scripts["build"]) {
      score += 10;

      // Modern build tools
      const buildCmd = scripts["build"];
      if (/\b(tsup|esbuild|vite|swc|unbuild|turbo)\b/.test(buildCmd)) {
        score += 10;
      } else if (/\bwebpack\b/.test(buildCmd)) {
        score += 5;
      }
    }

    // Reproducible builds (Turborepo cache, Docker multi-stage, etc.)
    if (await context.fileExists("turbo.json")) {
      score += 5;
    }

    // Package manager consistency
    if (await context.fileExists(".npmrc") || pkg?.["packageManager"]) {
      score += 5;
    }

    score = Math.min(100, Math.max(0, score));

    return {
      pillar: PILLAR,
      name: PILLAR_NAMES[PILLAR],
      score,
      weight: PILLAR_WEIGHTS[PILLAR],
      confidence: tsconfig ? "high" : "medium",
      findings,
      summary: `TypeScript strict: ${tsconfig ? "detected" : "no tsconfig"}, Lockfile: ${hasLockfile}, Build: ${scripts["build"] ? "yes" : "no"}`,
    };
  },
};

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

    // TypeScript projectReferences check
    if (tsconfig) {
      const references = tsconfig["references"] as unknown[] | undefined;
      if (references && Array.isArray(references) && references.length > 0) {
        score += 5;
      }
    }

    // Go interface{} / any abuse detection
    const goFiles = context.files.filter((f) => f.endsWith(".go") && !f.includes("vendor/"));
    if (goFiles.length > 0) {
      let goAnyCount = 0;
      const goSampled = goFiles.slice(0, 20);
      for (const goFile of goSampled) {
        const content = await context.readFile(goFile);
        if (!content) continue;
        const interfaceMatches = content.match(/\binterface\s*\{\s*\}/g);
        const anyMatches = content.match(/\bany\b/g);
        goAnyCount += (interfaceMatches?.length ?? 0) + (anyMatches?.length ?? 0);
      }
      if (goAnyCount > 10) {
        score -= 5;
        findings.push({
          code: "ARI-BLD-004",
          severity: "medium",
          pillar: PILLAR,
          message: `Found ${goAnyCount} uses of interface{}/any in Go files — reduces type safety`,
          remediation: {
            action: "refactor",
            description: "Replace interface{}/any with concrete types or generics where possible",
            confidence: "medium",
          },
        });
      } else if (goAnyCount === 0) {
        score += 5;
      }
    }

    // Rust excessive unwrap() detection
    const rsFiles = context.files.filter((f) => f.endsWith(".rs") && !f.includes("target/"));
    if (rsFiles.length > 0) {
      let unwrapCount = 0;
      const rsSampled = rsFiles.slice(0, 20);
      for (const rsFile of rsSampled) {
        const content = await context.readFile(rsFile);
        if (!content) continue;
        const matches = content.match(/\.unwrap\(\)/g);
        unwrapCount += matches?.length ?? 0;
      }
      if (unwrapCount > 20) {
        score -= 5;
        findings.push({
          code: "ARI-BLD-005",
          severity: "medium",
          pillar: PILLAR,
          message: `Found ${unwrapCount} uses of .unwrap() in Rust files — risk of panics at runtime`,
          remediation: {
            action: "refactor",
            description: "Replace .unwrap() with proper error handling (?, match, unwrap_or, etc.)",
            confidence: "medium",
          },
        });
      } else if (unwrapCount === 0 && rsFiles.length > 0) {
        score += 5;
      }
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

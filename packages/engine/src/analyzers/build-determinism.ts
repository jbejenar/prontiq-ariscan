import { type PillarId, PILLAR_NAMES, PILLAR_WEIGHTS, type Finding } from "@prontiq/ariscan-schema";
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
          confidence: "high",
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
          confidence: "high",
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
      const hasMypy =
        (await context.fileExists("mypy.ini")) || (await context.fileExists(".mypy.ini"));
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
          confidence: "high",
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
          confidence: "high",
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
      const isModernBuild = /\b(tsup|esbuild|vite|swc|unbuild|turbo)\b/.test(buildCmd);
      const isWebpack = /\bwebpack\b/.test(buildCmd);
      if (isModernBuild) {
        score += 10;
        findings.push({
          code: "ARI-BLD-010",
          severity: "info",
          pillar: PILLAR,
          message:
            "Modern build tool detected — fast, deterministic builds improve agent feedback loops",
          confidence: "high",
        });
      } else if (isWebpack) {
        score += 5;
        findings.push({
          code: "ARI-BLD-010",
          severity: "low",
          pillar: PILLAR,
          message:
            "Webpack detected — consider migrating to a faster bundler (tsup, esbuild, vite, swc) for shorter agent feedback loops",
          confidence: "high",
          remediation: {
            action: "modify-config",
            description:
              "Migrate from webpack to a modern bundler (tsup, esbuild, vite) for 10-50x faster builds",
            confidence: "medium",
          },
          evidence: {
            paper: "esbuild benchmark, 2024",
            finding:
              "esbuild/swc provide 10-100x faster builds than webpack, reducing agent wait time",
            confidence: "medium",
          },
        });
      }
    }

    // Reproducible builds (Turborepo cache, Docker multi-stage, etc.)
    if (await context.fileExists("turbo.json")) {
      score += 5;
    }

    // Package manager consistency
    if ((await context.fileExists(".npmrc")) || pkg?.["packageManager"]) {
      score += 5;
    }

    // TypeScript projectReferences check
    if (tsconfig) {
      const references = tsconfig["references"] as unknown[] | undefined;
      if (references && Array.isArray(references) && references.length > 0) {
        score += 5;
      }
    }

    // --- ARI-BLD-006: Monorepo project references ---
    const hasTurboJson = await context.fileExists("turbo.json");
    const hasNxJson = await context.fileExists("nx.json");
    const hasLernaJson = await context.fileExists("lerna.json");
    const hasPnpmWorkspace = await context.fileExists("pnpm-workspace.yaml");
    const detectedMonorepoTools: string[] = [];
    if (hasTurboJson) detectedMonorepoTools.push("Turborepo");
    if (hasNxJson) detectedMonorepoTools.push("Nx");
    if (hasLernaJson) detectedMonorepoTools.push("Lerna");
    if (hasPnpmWorkspace) detectedMonorepoTools.push("pnpm workspaces");

    if (detectedMonorepoTools.length > 0) {
      const hasProjectRefs = tsconfig
        ? (() => {
            const refs = tsconfig["references"] as unknown[] | undefined;
            return refs && Array.isArray(refs) && refs.length > 0;
          })()
        : false;

      findings.push({
        code: "ARI-BLD-006",
        severity: hasProjectRefs ? "info" : "medium",
        pillar: PILLAR,
        message: `Monorepo detected (${detectedMonorepoTools.join(", ")})${hasProjectRefs ? " with TypeScript project references configured" : " — consider adding TypeScript project references for faster incremental builds"}`,
        confidence: "high",
        remediation: hasProjectRefs
          ? undefined
          : {
              action: "modify-config",
              path: "tsconfig.json",
              description: "Add project references to tsconfig.json for each workspace package",
              confidence: "medium",
            },
      });
    }

    // --- ARI-BLD-007: Lockfile drift detection ---
    if (pkg) {
      const packageManagerField = pkg["packageManager"] as string | undefined;
      if (packageManagerField) {
        const pmName = packageManagerField.split("@")[0];
        const lockfileMap: Record<string, string[]> = {
          pnpm: ["pnpm-lock.yaml"],
          npm: ["package-lock.json"],
          yarn: ["yarn.lock"],
          bun: ["bun.lockb"],
        };
        const expectedLockfiles = pmName ? lockfileMap[pmName] : undefined;
        if (expectedLockfiles) {
          let hasExpected = false;
          for (const lf of expectedLockfiles) {
            if (await context.fileExists(lf)) {
              hasExpected = true;
              break;
            }
          }
          if (!hasExpected) {
            // Check if a different lockfile exists
            const allLockfileNames = Object.values(lockfileMap).flat();
            const wrongLockfiles: string[] = [];
            for (const lf of allLockfileNames) {
              if (await context.fileExists(lf)) {
                wrongLockfiles.push(lf);
              }
            }
            if (wrongLockfiles.length > 0) {
              score -= 5;
              findings.push({
                code: "ARI-BLD-007",
                severity: "high",
                pillar: PILLAR,
                message: `packageManager field specifies "${pmName}" but found lockfile(s) for a different package manager: ${wrongLockfiles.join(", ")}`,
                confidence: "high",
                remediation: {
                  action: "modify-config",
                  description: `Either update packageManager field to match the lockfile or regenerate the lockfile using ${pmName}`,
                  confidence: "high",
                },
              });
            }
          }
        }
      }
    }

    // Java nullability annotations check
    const javaFiles = context.files.filter(
      (f) => f.endsWith(".java") && !f.includes("build/") && !f.includes("target/"),
    );
    if (javaFiles.length > 0) {
      let hasNullabilityAnnotations = false;
      const javaSampled = javaFiles.slice(0, 20);
      for (const javaFile of javaSampled) {
        const content = await context.readFile(javaFile);
        if (!content) continue;
        if (
          /@(NonNull|Nullable|NotNull|Nonnull)\b/.test(content) ||
          /import\s+.*\b(CheckForNull|ParametersAreNonnullByDefault)\b/.test(content)
        ) {
          hasNullabilityAnnotations = true;
          break;
        }
      }

      // Check for NullAway, Checker Framework, or ErrorProne in build config
      let hasNullSafety = false;
      const pomXml = await context.readFile("pom.xml");
      const buildGradle =
        (await context.readFile("build.gradle")) ?? (await context.readFile("build.gradle.kts"));
      if (pomXml && /nullaway|checker-framework|error.prone/i.test(pomXml)) {
        hasNullSafety = true;
      }
      if (buildGradle && /nullaway|checkerFramework|errorprone/i.test(buildGradle)) {
        hasNullSafety = true;
      }

      if (hasNullabilityAnnotations || hasNullSafety) {
        score += 15;
      } else {
        findings.push({
          code: "ARI-BLD-008",
          severity: "medium",
          pillar: PILLAR,
          message:
            "Java project lacks nullability annotations — agents produce NullPointerException-prone code without null-safety constraints",
          confidence: "medium",
          remediation: {
            action: "add-dependency",
            description:
              "Add @NonNull/@Nullable annotations (JSR 305, JetBrains, or Jakarta) and consider NullAway or Checker Framework for compile-time enforcement",
            confidence: "high",
          },
          evidence: {
            paper: "GitHub Octoverse, 2025",
            finding: "94% of LLM compilation errors are type-check failures",
            confidence: "high",
          },
        });
      }
    }

    // C# nullable reference types check
    const csharpFiles = context.files.filter(
      (f) => f.endsWith(".cs") && !f.includes("bin/") && !f.includes("obj/"),
    );
    if (csharpFiles.length > 0) {
      let hasNullable = false;

      // Check .csproj files for <Nullable>enable</Nullable>
      const csprojFiles = context.files.filter((f) => f.endsWith(".csproj"));
      for (const csproj of csprojFiles.slice(0, 5)) {
        const content = await context.readFile(csproj);
        if (content && /<Nullable>\s*enable\s*<\/Nullable>/i.test(content)) {
          hasNullable = true;
          break;
        }
      }

      // Also check for #nullable enable directives in source files
      if (!hasNullable) {
        for (const csFile of csharpFiles.slice(0, 10)) {
          const content = await context.readFile(csFile);
          if (content && /#nullable\s+enable/.test(content)) {
            hasNullable = true;
            break;
          }
        }
      }

      if (hasNullable) {
        score += 20;
      } else {
        findings.push({
          code: "ARI-BLD-009",
          severity: "medium",
          pillar: PILLAR,
          message:
            "C# project has nullable reference types disabled — agents lack compile-time null safety guidance",
          confidence: "high",
          remediation: {
            action: "modify-config",
            description:
              "Add <Nullable>enable</Nullable> to your .csproj PropertyGroup to enable nullable reference types",
            confidence: "high",
          },
          evidence: {
            paper: "TyFlow, Huang et al., 2025",
            finding: "33.6% of failed LM-generated programs fail due to type errors",
            confidence: "high",
          },
        });
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
          confidence: "medium",
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
          confidence: "medium",
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

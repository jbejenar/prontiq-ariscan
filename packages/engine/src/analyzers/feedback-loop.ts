import { type PillarId, PILLAR_NAMES, type Finding } from "@prontiq/ariscan-schema";
import type { PillarAnalyzer, RepoContext } from "./analyzer.interface.js";
import { buildPillarResult, clampScore, anyFileExists } from "./shared.js";

const PILLAR: PillarId = "P2";

export const feedbackLoopAnalyzer: PillarAnalyzer = {
  pillar: PILLAR,
  name: PILLAR_NAMES[PILLAR],
  version: "0.2.0",

  async supports(): Promise<boolean> {
    return true;
  },

  async analyze(context: RepoContext) {
    const findings: Finding[] = [];

    // --- Gather signals ---

    const pkg = await context.readJson<Record<string, unknown>>("package.json");
    const scripts = (pkg?.["scripts"] ?? {}) as Record<string, string>;

    // --- Local feedback signals (2x weight) ---
    let localScore = 0;

    // Test command (local)
    const hasTestCmd = !!scripts["test"];
    if (hasTestCmd) {
      localScore += 20;
      // Watch mode
      if (scripts["test:watch"] || scripts["test:dev"]) {
        localScore += 5;
      }
    } else {
      const hasMakefile = await context.fileExists("Makefile");
      const hasPyproject = await context.fileExists("pyproject.toml");
      if (hasMakefile || hasPyproject) {
        localScore += 10;
      } else {
        findings.push({
          code: "ARI-FBK-001",
          severity: "high",
          pillar: PILLAR,
          message: "No test command found in package.json scripts",
          confidence: "high",
          remediation: {
            action: "add-script",
            description: "Add a 'test' script to package.json",
            confidence: "high",
          },
          evidence: {
            paper: "DORA, 2024",
            finding:
              "AI adoption without fast feedback loops decreases throughput 1.5%, stability 7.2%",
            confidence: "high",
          },
        });
      }
    }

    // Lint command (local)
    const hasLintCmd = !!(scripts["lint"] || scripts["lint:check"]);
    if (hasLintCmd) {
      localScore += 15;
    } else {
      findings.push({
        code: "ARI-FBK-002",
        severity: "medium",
        pillar: PILLAR,
        message: "No lint command found",
        confidence: "high",
        remediation: {
          action: "add-script",
          description: "Add a 'lint' script to package.json with ESLint or equivalent",
          confidence: "high",
        },
      });
    }

    // Typecheck command (local)
    const hasTypecheckCmd = !!(scripts["typecheck"] || scripts["type-check"] || scripts["tsc"]);
    if (hasTypecheckCmd) {
      localScore += 15;
    } else {
      const hasTsConfig = await context.fileExists("tsconfig.json");
      if (hasTsConfig) {
        findings.push({
          code: "ARI-FBK-003",
          severity: "medium",
          pillar: PILLAR,
          message: "TypeScript project without a dedicated typecheck script",
          confidence: "high",
          remediation: {
            action: "add-script",
            description: "Add 'typecheck': 'tsc --noEmit' to package.json scripts",
            confidence: "high",
          },
        });
      }
    }

    // Pre-commit hooks (local)
    const hasHusky = await context.fileExists(".husky");
    const hasPreCommit = await context.fileExists(".pre-commit-config.yaml");
    const hasLefthook = await context.fileExists("lefthook.yml");
    if (hasHusky || hasPreCommit || hasLefthook) {
      localScore += 10;
    }

    // Build tool modernity (local)
    if (scripts["build"]) {
      localScore += 10;
      const buildCmd = scripts["build"];
      if (/\b(vite|esbuild|tsup|swc|turbo)\b/.test(buildCmd)) {
        localScore += 5; // Modern fast build tool
      }
    }

    // --- CI feedback signals (1x weight) ---
    let ciScore = 0;

    const ciConfigs = [
      ".github/workflows",
      ".gitlab-ci.yml",
      "Jenkinsfile",
      ".circleci/config.yml",
      ".travis.yml",
    ];
    let hasCI = false;
    for (const ci of ciConfigs) {
      if (context.files.some((f) => f.startsWith(ci.replace(/\/$/, "")))) {
        hasCI = true;
        break;
      }
    }
    if (hasCI) {
      ciScore += 15;
    } else {
      findings.push({
        code: "ARI-FBK-004",
        severity: "medium",
        pillar: PILLAR,
        message: "No CI configuration found",
        confidence: "high",
        remediation: {
          action: "create-file",
          path: ".github/workflows/ci.yml",
          description: "Add CI pipeline for automated testing on push/PR",
          confidence: "high",
        },
      });
    }

    // Changeset scope controls (CI-adjacent)
    let hasChangesetControls = await anyFileExists(context, [
      "commitlint.config.js",
      "commitlint.config.cjs",
      "commitlint.config.ts",
      ".commitlintrc",
      ".commitlintrc.json",
      ".commitlintrc.yml",
      ".commitlintrc.yaml",
      ".commitlintrc.js",
      ".commitlintrc.cjs",
    ]);

    if (!hasChangesetControls && pkg) {
      const commitlint = pkg["commitlint"] as Record<string, unknown> | undefined;
      if (commitlint) {
        hasChangesetControls = true;
      }
    }

    if (!hasChangesetControls) {
      if (await context.fileExists(".changeset/config.json")) {
        hasChangesetControls = true;
      }
    }

    if (!hasChangesetControls) {
      const hasDangerfile =
        (await context.fileExists("dangerfile.ts")) || (await context.fileExists("dangerfile.js"));
      if (hasDangerfile) {
        hasChangesetControls = true;
      }
    }

    if (hasChangesetControls) {
      ciScore += 5;
    } else {
      findings.push({
        code: "ARI-FBK-006",
        severity: "low",
        pillar: PILLAR,
        message: "No changeset scope controls found (commitlint, changesets, or Danger)",
        confidence: "high",
        remediation: {
          action: "configure-tool",
          description:
            "Add commitlint for conventional commits or @changesets/cli for scoped changesets",
          confidence: "medium",
        },
      });
    }

    // --- Weighted score: local 2x, CI 1x ---
    // Normalize: local max ~80, CI max ~20. Apply 2:1 weighting.
    // Total raw = localScore * 2 + ciScore * 1, then normalize to 0-100.
    // Max local = 80, max CI = 20. Max raw = 80*2 + 20*1 = 180.
    // Normalize: score = raw * 100 / 180
    const rawWeighted = localScore * 2 + ciScore;
    const maxWeighted = 80 * 2 + 20; // 180
    let score = Math.round((rawWeighted / maxWeighted) * 100);

    // --- Watch mode finding (ARI-FBK-007) ---
    const hasWatchMode = !!(
      scripts["test:watch"] ||
      scripts["test:dev"] ||
      scripts["dev"] ||
      scripts["start:dev"]
    );
    if (hasWatchMode) {
      findings.push({
        code: "ARI-FBK-007",
        severity: "info",
        pillar: PILLAR,
        message: "Watch mode detected",
        confidence: "medium",
      });
    } else {
      findings.push({
        code: "ARI-FBK-007",
        severity: "low",
        pillar: PILLAR,
        message: "No watch mode command found",
        confidence: "medium",
        remediation: {
          action: "add-script",
          description:
            "Add a 'test:watch' or 'dev' script for continuous feedback during development",
          confidence: "high",
        },
      });
    }

    // --- Incremental build finding (ARI-FBK-008) ---
    const hasTurbo =
      (await context.fileExists("turbo.json")) || !!scripts["build"]?.includes("turbo");
    const hasNx = (await context.fileExists("nx.json")) || !!scripts["build"]?.includes("nx ");
    const hasIncrementalBuild = hasTurbo || hasNx;
    if (hasIncrementalBuild) {
      score += 5; // bonus for incremental build
      findings.push({
        code: "ARI-FBK-008",
        severity: "info",
        pillar: PILLAR,
        message: `Incremental build detected (${hasTurbo ? "turbo" : "nx"})`,
        confidence: "high",
      });
    } else {
      findings.push({
        code: "ARI-FBK-008",
        severity: "low",
        pillar: PILLAR,
        message: "No incremental build configuration",
        confidence: "high",
        remediation: {
          action: "configure-tool",
          description: "Add Turborepo or Nx for incremental/cached builds",
          confidence: "medium",
        },
      });
    }

    // --- Change-scope heuristics (ARI-FBK-010) ---
    const changeScopeControls: string[] = [];

    // 1. PR size limits: workflow files with size-limit patterns, or dangerfile
    let hasPrSizeLimits = false;
    const workflowFiles = context.files.filter((f) => /^\.github\/workflows\/.*\.ya?ml$/.test(f));
    for (const wf of workflowFiles) {
      const content = await context.readFile(wf);
      if (content && /max-.*lines|diff.*size|pr.*size|changed.*files.*limit/i.test(content)) {
        hasPrSizeLimits = true;
        break;
      }
    }
    if (!hasPrSizeLimits) {
      const dangerContent =
        (await context.readFile("dangerfile.ts")) ?? (await context.readFile("dangerfile.js"));
      if (dangerContent && /lines|size|diff|big/i.test(dangerContent)) {
        hasPrSizeLimits = true;
      }
    }
    if (hasPrSizeLimits) {
      changeScopeControls.push("PR size limits");
    }

    // 2. Conventional commits (reuse existing detection)
    if (hasChangesetControls) {
      changeScopeControls.push("conventional commits");
    }

    // 3. Monorepo package boundaries
    const packageDirs = context.files.filter((f) => /^packages\/[^/]+\//.test(f));
    const uniquePackages = new Set(packageDirs.map((f) => f.split("/")[1]));
    const hasPackageBoundaries = uniquePackages.size >= 2 && (hasTurbo || hasNx);
    if (hasPackageBoundaries) {
      changeScopeControls.push("package boundaries");
    }

    // 4. Breaking change detection
    const hasChangesetConfig = await context.fileExists(".changeset/config.json");
    let hasBreakingChangeDetection = hasChangesetConfig;
    if (!hasBreakingChangeDetection && pkg) {
      const deps = {
        ...(pkg["dependencies"] as Record<string, string> | undefined),
        ...(pkg["devDependencies"] as Record<string, string> | undefined),
      };
      if (deps["semantic-release"] || deps["standard-version"]) {
        hasBreakingChangeDetection = true;
      }
    }
    if (hasBreakingChangeDetection) {
      changeScopeControls.push("breaking change detection");
    }

    const changeScopeCount = changeScopeControls.length;
    const allCategories = [
      "PR size limits",
      "conventional commits",
      "package boundaries",
      "breaking change detection",
    ];
    const missingControls = allCategories.filter((c) => !changeScopeControls.includes(c));

    const detectedList = changeScopeControls.join(", ") || "none";
    const missingList = missingControls.join(", ");
    const changeScopeMessage = `Change-scope controls: ${changeScopeCount}/4 detected (${detectedList}).${missingControls.length > 0 ? ` Missing: ${missingList}.` : ""}`;

    if (changeScopeCount === 0) {
      findings.push({
        code: "ARI-FBK-010",
        severity: "medium",
        pillar: PILLAR,
        message: changeScopeMessage,
        confidence: "medium",
        remediation: {
          action: "configure-tool",
          description: `Add change-scope controls to prevent AI agents from producing oversized PRs. Missing: ${missingList}. DORA 2024 found AI increases batch sizes, which consistently introduces more risk.`,
          confidence: "medium",
        },
        evidence: {
          paper: "DORA, 2024",
          finding:
            "AI adoption without fast feedback loops decreases throughput 1.5%, stability 7.2%",
          confidence: "high",
        },
      });
    } else if (changeScopeCount <= 2) {
      findings.push({
        code: "ARI-FBK-010",
        severity: "info",
        pillar: PILLAR,
        message: changeScopeMessage,
        confidence: "medium",
        remediation: {
          action: "configure-tool",
          description: `Add change-scope controls to prevent AI agents from producing oversized PRs. Missing: ${missingList}. DORA 2024 found AI increases batch sizes, which consistently introduces more risk.`,
          confidence: "medium",
        },
        evidence: {
          paper: "DORA, 2024",
          finding:
            "AI adoption without fast feedback loops decreases throughput 1.5%, stability 7.2%",
          confidence: "high",
        },
      });
    } else {
      findings.push({
        code: "ARI-FBK-010",
        severity: "info",
        pillar: PILLAR,
        message: changeScopeMessage,
        confidence: "high",
        evidence: {
          paper: "DORA, 2024",
          finding:
            "AI adoption without fast feedback loops decreases throughput 1.5%, stability 7.2%",
          confidence: "high",
        },
      });
    }

    score += Math.min(12, changeScopeCount * 3);

    // --- Estimated execution time / feedback latency (ARI-FBK-009) ---
    const vitestConfig =
      (await context.readFile("vitest.config.ts")) ?? (await context.readFile("vitest.config.js"));
    const jestConfig =
      (await context.readFile("jest.config.ts")) ??
      (await context.readFile("jest.config.js")) ??
      (await context.readFile("jest.config.json"));
    const testRunnerConfig = vitestConfig ?? jestConfig;

    let latencyLabel: "measured" | "inferred" | "unknown" = "unknown";
    let latencyEstimate = "unknown";

    if (testRunnerConfig) {
      const timeoutMatch = testRunnerConfig.match(/timeout\s*[:=]\s*(\d+)/);
      if (timeoutMatch && timeoutMatch[1]) {
        const timeout = parseInt(timeoutMatch[1], 10);
        latencyLabel = "measured";
        if (timeout <= 30000) {
          latencyEstimate = `fast (timeout: ${timeout}ms)`;
          score += 5;
        } else if (timeout <= 60000) {
          latencyEstimate = `medium (timeout: ${timeout}ms)`;
          score += 3;
        } else {
          latencyEstimate = `slow (timeout: ${timeout}ms)`;
          findings.push({
            code: "ARI-FBK-005",
            severity: "medium",
            pillar: PILLAR,
            message: `Test timeout is ${timeout}ms (>60s) — slow feedback loop`,
            confidence: "medium",
            remediation: {
              action: "modify-config",
              description:
                "Lower test timeouts and optimize slow tests. Target <30s for unit tests.",
              confidence: "medium",
            },
            evidence: {
              paper: "DORA, 2024",
              finding:
                "AI adoption without fast feedback loops decreases throughput 1.5%, stability 7.2%",
              confidence: "high",
            },
          });
        }
      } else if (vitestConfig) {
        // Vitest defaults to 5s timeout — assume fast
        latencyLabel = "inferred";
        latencyEstimate = "fast (vitest defaults)";
        score += 5;
      } else {
        // Jest without explicit timeout
        latencyLabel = "inferred";
        latencyEstimate = "medium (jest defaults)";
        score += 3;
      }
    } else if (hasTestCmd) {
      // Has test command but no recognized config file
      const testCmd = scripts["test"] ?? "";
      if (/vitest/i.test(testCmd)) {
        latencyLabel = "inferred";
        latencyEstimate = "fast (vitest)";
        score += 4;
      } else if (/jest/i.test(testCmd)) {
        latencyLabel = "inferred";
        latencyEstimate = "medium (jest)";
        score += 2;
      } else if (/mocha|ava|tap/i.test(testCmd)) {
        latencyLabel = "inferred";
        latencyEstimate = "medium (test runner)";
        score += 2;
      } else {
        latencyLabel = "unknown";
        latencyEstimate = "unknown";
      }
    }

    findings.push({
      code: "ARI-FBK-009",
      severity: "info",
      pillar: PILLAR,
      message: `Estimated feedback latency: ${latencyEstimate} (confidence: ${latencyLabel})`,
      confidence:
        latencyLabel === "measured" ? "high" : latencyLabel === "inferred" ? "medium" : "low",
    });

    score = clampScore(score);

    return buildPillarResult(
      PILLAR,
      score,
      pkg ? "high" : "low",
      findings,
      `Feedback loop score: ${score}/100. Test: ${hasTestCmd ? "yes" : "no"}, Lint: ${hasLintCmd ? "yes" : "no"}, CI: ${hasCI ? "yes" : "no"}`,
    );
  },
};

import { type PillarId, PILLAR_NAMES, PILLAR_WEIGHTS, type Finding } from "@prontiq/schema";
import type { PillarAnalyzer, RepoContext } from "./analyzer.interface.js";

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
          remediation: {
            action: "add-script",
            description: "Add a 'test' script to package.json",
            confidence: "high",
          },
          evidence: {
            paper: "DORA, 2024",
            finding: "AI adoption without fast feedback loops decreases throughput 1.5%, stability 7.2%",
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
        remediation: {
          action: "create-file",
          path: ".github/workflows/ci.yml",
          description: "Add CI pipeline for automated testing on push/PR",
          confidence: "high",
        },
      });
    }

    // Changeset scope controls (CI-adjacent)
    let hasChangesetControls = false;
    const commitlintConfigs = [
      "commitlint.config.js",
      "commitlint.config.cjs",
      "commitlint.config.ts",
      ".commitlintrc",
      ".commitlintrc.json",
      ".commitlintrc.yml",
      ".commitlintrc.yaml",
      ".commitlintrc.js",
      ".commitlintrc.cjs",
    ];
    for (const cfg of commitlintConfigs) {
      if (await context.fileExists(cfg)) {
        hasChangesetControls = true;
        break;
      }
    }

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
      const hasDangerfile = await context.fileExists("dangerfile.ts") || await context.fileExists("dangerfile.js");
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
        remediation: {
          action: "configure-tool",
          description: "Add commitlint for conventional commits or @changesets/cli for scoped changesets",
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
    const maxWeighted = 80 * 2 + 20;  // 180
    let score = Math.round((rawWeighted / maxWeighted) * 100);

    // --- Watch mode finding (ARI-FBK-007) ---
    const hasWatchMode = !!(scripts["test:watch"] || scripts["test:dev"] || scripts["dev"] || scripts["start:dev"]);
    if (hasWatchMode) {
      findings.push({
        code: "ARI-FBK-007",
        severity: "info",
        pillar: PILLAR,
        message: "Watch mode detected",
      });
    } else {
      findings.push({
        code: "ARI-FBK-007",
        severity: "low",
        pillar: PILLAR,
        message: "No watch mode command found",
        remediation: {
          action: "add-script",
          description: "Add a 'test:watch' or 'dev' script for continuous feedback during development",
          confidence: "high",
        },
      });
    }

    // --- Incremental build finding (ARI-FBK-008) ---
    const hasTurbo = await context.fileExists("turbo.json") || !!scripts["build"]?.includes("turbo");
    const hasNx = await context.fileExists("nx.json") || !!scripts["build"]?.includes("nx ");
    const hasIncrementalBuild = hasTurbo || hasNx;
    if (hasIncrementalBuild) {
      score += 5; // bonus for incremental build
      findings.push({
        code: "ARI-FBK-008",
        severity: "info",
        pillar: PILLAR,
        message: `Incremental build detected (${hasTurbo ? "turbo" : "nx"})`,
      });
    } else {
      findings.push({
        code: "ARI-FBK-008",
        severity: "low",
        pillar: PILLAR,
        message: "No incremental build configuration",
        remediation: {
          action: "configure-tool",
          description: "Add Turborepo or Nx for incremental/cached builds",
          confidence: "medium",
        },
      });
    }

    // --- Estimated execution time / feedback latency (ARI-FBK-009) ---
    const vitestConfig = await context.readFile("vitest.config.ts") ?? await context.readFile("vitest.config.js");
    const jestConfig = await context.readFile("jest.config.ts") ?? await context.readFile("jest.config.js") ?? await context.readFile("jest.config.json");
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
            remediation: {
              action: "modify-config",
              description: "Lower test timeouts and optimize slow tests. Target <30s for unit tests.",
              confidence: "medium",
            },
            evidence: {
              paper: "DORA, 2024",
              finding: "AI adoption without fast feedback loops decreases throughput 1.5%, stability 7.2%",
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
    });

    score = Math.min(100, Math.max(0, score));

    return {
      pillar: PILLAR,
      name: PILLAR_NAMES[PILLAR],
      score,
      weight: PILLAR_WEIGHTS[PILLAR],
      confidence: pkg ? "high" : "low",
      findings,
      summary: `Feedback loop score: ${score}/100. Test: ${hasTestCmd ? "yes" : "no"}, Lint: ${hasLintCmd ? "yes" : "no"}, CI: ${hasCI ? "yes" : "no"}`,
    };
  },
};

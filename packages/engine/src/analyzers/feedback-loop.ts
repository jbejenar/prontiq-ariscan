import { type PillarId, PILLAR_NAMES, PILLAR_WEIGHTS, type Finding } from "@prontiq/schema";
import type { PillarAnalyzer, RepoContext } from "./analyzer.interface.js";

const PILLAR: PillarId = "P2";

export const feedbackLoopAnalyzer: PillarAnalyzer = {
  pillar: PILLAR,
  name: PILLAR_NAMES[PILLAR],
  version: "0.1.0",

  async supports(): Promise<boolean> {
    return true;
  },

  async analyze(context: RepoContext) {
    const findings: Finding[] = [];
    let score = 0;

    // Check package.json for scripts
    const pkg = await context.readJson<Record<string, unknown>>("package.json");
    const scripts = (pkg?.["scripts"] ?? {}) as Record<string, string>;

    // Test command
    if (scripts["test"]) {
      score += 20;
      // Check for watch mode
      if (scripts["test:watch"] || scripts["test:dev"]) {
        score += 5;
      }
    } else {
      // Check for other test runners
      const hasMakefile = await context.fileExists("Makefile");
      const hasPyproject = await context.fileExists("pyproject.toml");
      if (hasMakefile || hasPyproject) {
        score += 10;
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

    // Lint command
    if (scripts["lint"] || scripts["lint:check"]) {
      score += 15;
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

    // Typecheck command
    if (scripts["typecheck"] || scripts["type-check"] || scripts["tsc"]) {
      score += 15;
    } else {
      // Check if TypeScript is used
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

    // CI config
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
      score += 15;
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

    // Pre-commit hooks
    const hasHusky = await context.fileExists(".husky");
    const hasPreCommit = await context.fileExists(".pre-commit-config.yaml");
    const hasLefthook = await context.fileExists("lefthook.yml");
    if (hasHusky || hasPreCommit || hasLefthook) {
      score += 10;
    }

    // Build tool modernity
    if (scripts["build"]) {
      score += 10;
      const buildCmd = scripts["build"];
      if (/\b(vite|esbuild|tsup|swc|turbo)\b/.test(buildCmd)) {
        score += 5; // Modern fast build tool
      }
    }

    // Incremental build detection
    if (await context.fileExists("turbo.json") || scripts["build"]?.includes("turbo")) {
      score += 5;
    }

    score = Math.min(100, Math.max(0, score));

    return {
      pillar: PILLAR,
      name: PILLAR_NAMES[PILLAR],
      score,
      weight: PILLAR_WEIGHTS[PILLAR],
      confidence: pkg ? "high" : "low",
      findings,
      summary: `Feedback loop score: ${score}/100. Test: ${scripts["test"] ? "yes" : "no"}, Lint: ${scripts["lint"] ? "yes" : "no"}, CI: ${hasCI ? "yes" : "no"}`,
    };
  },
};

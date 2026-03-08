import { type PillarId, PILLAR_NAMES, PILLAR_WEIGHTS, type Finding } from "@prontiq/schema";
import type { PillarAnalyzer, RepoContext } from "./analyzer.interface.js";

const PILLAR: PillarId = "P3";

const TEST_FILE_PATTERNS = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /_test\.[jt]sx?$/,
  /_test\.go$/,
  /test_.*\.py$/,
  /.*_test\.py$/,
  /Test\.java$/,
  /Tests?\.cs$/,
  /_spec\.rb$/,
];

const ANTI_PATTERNS = [
  { pattern: /\b(AWS|azure|gcp|google\.cloud)\b/i, code: "ARI-TST-001", message: "Cloud SDK reference in test file", severity: "high" as const },
  { pattern: /\bfetch\s*\(|axios\.|requests\.(get|post|put|delete)|http\.Get/i, code: "ARI-TST-002", message: "Direct HTTP call in test — should use mocks/stubs", severity: "high" as const },
  { pattern: /\b(Date\.now|new Date|time\.Now|datetime\.now)\b/, code: "ARI-TST-003", message: "Non-deterministic time usage in test", severity: "medium" as const },
  { pattern: /\bMath\.random\b|random\.\w+\(/, code: "ARI-TST-004", message: "Non-deterministic random usage in test", severity: "medium" as const },
  { pattern: /process\.env\[|os\.environ|os\.Getenv/, code: "ARI-TST-005", message: "Direct environment variable access in test", severity: "medium" as const },
];

export const testIsolationAnalyzer: PillarAnalyzer = {
  pillar: PILLAR,
  name: PILLAR_NAMES[PILLAR],
  version: "0.1.0",

  async supports(): Promise<boolean> {
    return true;
  },

  async analyze(context: RepoContext) {
    const findings: Finding[] = [];
    let score = 0;

    // Find test files
    const testFiles = context.files.filter((f) =>
      TEST_FILE_PATTERNS.some((p) => p.test(f)),
    );

    const sourceFiles = context.files.filter(
      (f) =>
        /\.[jt]sx?$|\.py$|\.go$|\.java$|\.cs$|\.rb$/.test(f) &&
        !TEST_FILE_PATTERNS.some((p) => p.test(f)) &&
        !f.includes("node_modules"),
    );

    if (testFiles.length === 0) {
      findings.push({
        code: "ARI-TST-006",
        severity: "critical",
        pillar: PILLAR,
        message: "No test files found in the repository",
        remediation: {
          action: "create-file",
          description: "Add test files for your source code. A healthy test-to-source ratio is 0.5-1.0.",
          confidence: "high",
        },
        evidence: {
          paper: "Memon et al., 2017",
          finding: "41% of intermittent test failures at Google are flaky",
          confidence: "high",
        },
      });
      return {
        pillar: PILLAR,
        name: PILLAR_NAMES[PILLAR],
        score: 0,
        weight: PILLAR_WEIGHTS[PILLAR],
        confidence: "high",
        findings,
        summary: "No test files found",
      };
    }

    // Test-to-source ratio
    const ratio = sourceFiles.length > 0 ? testFiles.length / sourceFiles.length : 0;
    if (ratio >= 0.8) {
      score += 25;
    } else if (ratio >= 0.5) {
      score += 20;
    } else if (ratio >= 0.2) {
      score += 10;
    } else {
      score += 5;
      findings.push({
        code: "ARI-TST-007",
        severity: "medium",
        pillar: PILLAR,
        message: `Low test-to-source ratio: ${ratio.toFixed(2)} (${testFiles.length} tests / ${sourceFiles.length} sources)`,
        remediation: {
          action: "create-file",
          description: "Add more test files. Target a test-to-source ratio of 0.5 or higher.",
          confidence: "medium",
        },
      });
    }

    // Scan test files for anti-patterns (sample up to 20 files)
    const sampled = testFiles.slice(0, 20);
    let antiPatternCount = 0;

    for (const testFile of sampled) {
      const content = await context.readFile(testFile);
      if (!content) continue;

      for (const ap of ANTI_PATTERNS) {
        if (ap.pattern.test(content)) {
          antiPatternCount++;
          findings.push({
            code: ap.code,
            severity: ap.severity,
            pillar: PILLAR,
            file: testFile,
            message: ap.message,
            remediation: {
              action: "refactor",
              description: "Replace with mock/stub/fake implementation for test isolation",
              confidence: "medium",
            },
            evidence: {
              paper: "Berndt et al., 2026",
              finding: "63% of LLM-generated flaky tests from unordered collection assumptions",
              confidence: "high",
            },
          });
        }
      }
    }

    // Anti-pattern scoring
    if (antiPatternCount === 0) {
      score += 30;
    } else if (antiPatternCount <= 3) {
      score += 20;
    } else if (antiPatternCount <= 10) {
      score += 10;
    }

    // Check for DI/provider patterns (match filename only, exclude .devcontainer paths)
    const hasProviderPattern = context.files.some(
      (f) => {
        if (/\.devcontainer/i.test(f)) return false;
        const filename = f.split("/").pop() ?? f;
        return /provider|factory|container|inject/i.test(filename);
      },
    );
    if (hasProviderPattern) {
      score += 15;
    }

    // Check for mock/stub infrastructure
    const hasMockInfra = context.files.some(
      (f) => /__mocks__|\.mock\.|mock\//i.test(f),
    );
    if (hasMockInfra) {
      score += 10;
    }

    // Check for test config (jest.config, vitest.config, etc.)
    const hasTestConfig = context.files.some(
      (f) => /jest\.config|vitest\.config|pytest\.ini|conftest\.py|\.mocharc/i.test(f),
    );
    if (hasTestConfig) {
      score += 5;
    }

    score = Math.min(100, Math.max(0, score));

    return {
      pillar: PILLAR,
      name: PILLAR_NAMES[PILLAR],
      score,
      weight: PILLAR_WEIGHTS[PILLAR],
      confidence: sampled.length >= 10 ? "high" : "medium",
      findings,
      summary: `${testFiles.length} test files found, ratio ${ratio.toFixed(2)}, ${antiPatternCount} anti-patterns detected`,
    };
  },
};

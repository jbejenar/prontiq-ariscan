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

/** Patterns that detect filesystem dependencies in tests */
const FS_DEPENDENCY_PATTERNS = [
  /\bfs\.(readFileSync|writeFileSync|readFile|writeFile|mkdirSync|mkdir|readdirSync|readdir|existsSync|exists|unlinkSync|unlink)\b/,
  /\bopen\s*\(.*['"rwa]/,
  /\bos\.(path\.|remove|makedirs|listdir)\b/,
  /\bioutil\.(ReadFile|WriteFile|TempDir)\b/,
  /\bFile\.(open|read|write|delete)\b/i,
];

/** Patterns that detect order-sensitive assertions on unordered collections */
const ORDER_SENSITIVE_PATTERNS = [
  /\b(toEqual|toBe|to_equal|assert_eq|assertEqual)\b.*\b(Object\.keys|Object\.values|Object\.entries)\b/,
  /\b(Object\.keys|Object\.values|Object\.entries)\b.*\b(toEqual|toBe|to_equal|assert_eq|assertEqual)\b/,
  /\b(toEqual|toBe|to_equal|assert_eq|assertEqual)\b.*\b(new Set|new Map|Set\(|Map\()\b/,
  /\b(new Set|new Map|Set\(|Map\()\b.*\b(toEqual|toBe|to_equal|assert_eq|assertEqual)\b/,
  /\.keys\(\)\s*\)\s*\.\s*(toEqual|toBe)/,
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

    // Filesystem dependency detection in tests
    let fsDependencyCount = 0;
    for (const testFile of sampled) {
      const content = await context.readFile(testFile);
      if (!content) continue;

      for (const fsPattern of FS_DEPENDENCY_PATTERNS) {
        if (fsPattern.test(content)) {
          fsDependencyCount++;
          findings.push({
            code: "ARI-TST-008",
            severity: "medium",
            pillar: PILLAR,
            file: testFile,
            message: "Test file accesses the real filesystem — should use mocks or in-memory FS",
            remediation: {
              action: "refactor",
              description: "Replace real filesystem calls with mock/stub/in-memory implementations",
              confidence: "medium",
            },
          });
          break; // one finding per file
        }
      }
    }

    // Order-sensitive assertion detection
    let orderSensitiveCount = 0;
    for (const testFile of sampled) {
      const content = await context.readFile(testFile);
      if (!content) continue;

      const lines = content.split("\n");
      for (const line of lines) {
        for (const osPattern of ORDER_SENSITIVE_PATTERNS) {
          if (osPattern.test(line)) {
            orderSensitiveCount++;
            findings.push({
              code: "ARI-TST-009",
              severity: "medium",
              pillar: PILLAR,
              file: testFile,
              message: "Assertion on unordered collection without sorting — may cause flaky tests",
              remediation: {
                action: "refactor",
                description: "Sort the collection before asserting, or use an unordered matcher (e.g. toContain, arrayContaining)",
                confidence: "medium",
              },
              evidence: {
                paper: "Berndt et al., 2026",
                finding: "63% of LLM-generated flaky tests from unordered collection assumptions",
                confidence: "high",
              },
            });
            break; // one finding per file for this pattern
          }
        }
        if (orderSensitiveCount > 0) break; // limit to one per file
      }
    }

    // Anti-pattern scoring (includes fs deps and order-sensitive assertions)
    const totalAntiPatterns = antiPatternCount + fsDependencyCount + orderSensitiveCount;
    if (totalAntiPatterns === 0) {
      score += 30;
    } else if (totalAntiPatterns <= 3) {
      score += 20;
    } else if (totalAntiPatterns <= 10) {
      score += 10;
    }

    // Test file count ratio check
    if (sourceFiles.length > 0) {
      const testFileRatio = testFiles.length / sourceFiles.length;
      if (testFileRatio < 0.1) {
        findings.push({
          code: "ARI-TST-010",
          severity: "high",
          pillar: PILLAR,
          message: `Very low test file count ratio: ${testFileRatio.toFixed(2)} (${testFiles.length} test files / ${sourceFiles.length} source files). Target at least 0.5.`,
          remediation: {
            action: "create-file",
            description: "Add test files for untested source modules. Aim for at least 1 test file per 2 source files.",
            confidence: "high",
          },
        });
      }
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
      summary: `${testFiles.length} test files found, ratio ${ratio.toFixed(2)}, ${totalAntiPatterns} anti-patterns detected`,
    };
  },
};

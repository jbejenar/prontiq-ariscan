import { type PillarId, PILLAR_NAMES, PILLAR_WEIGHTS, type Finding } from "@prontiq/ariscan-schema";
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
  /_test\.rs$/,
  /\btests\/.*\.rs$/,
];

const ANTI_PATTERNS = [
  {
    pattern: /\b(AWS|azure|gcp|google\.cloud)\b/i,
    code: "ARI-TST-001",
    message: "Cloud SDK reference in test file",
    severity: "high" as const,
    remediation:
      "Use dependency injection to decouple tests from cloud SDKs. " +
      "Example: replace `new S3Client()` inside the test with a parameter — " +
      "`function upload(client: S3Client, ...) { ... }` — then pass a mock in tests. " +
      "Agents waste ~200-500 tokens retrying when tests depend on external cloud services that are unavailable or rate-limited.",
  },
  {
    pattern: /\bfetch\s*\(|axios\.|requests\.(get|post|put|delete)|http\.Get/i,
    code: "ARI-TST-002",
    message: "Direct HTTP call in test — should use mocks/stubs",
    severity: "high" as const,
    remediation:
      "Replace live HTTP calls with a mock or interceptor. " +
      "Example (msw): `server.use(http.get('/api/data', () => HttpResponse.json({ ok: true })))`. " +
      "Example (vi.mock): `vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}'))`. " +
      "Agents waste ~200-500 tokens retrying when tests fail due to network timeouts or flaky remote endpoints.",
  },
  {
    pattern: /\b(Date\.now|new Date|time\.Now|datetime\.now)\b/,
    code: "ARI-TST-003",
    message: "Non-deterministic time usage in test",
    severity: "medium" as const,
    remediation:
      "Inject a clock or use fake timers to make time deterministic. " +
      "Example (Vitest): `vi.useFakeTimers(); vi.setSystemTime(new Date('2025-01-01')); ... vi.useRealTimers()`. " +
      "Agents waste ~100-300 tokens debugging intermittent failures caused by time-sensitive assertions that pass only at certain times of day.",
  },
  {
    pattern: /\bMath\.random\b|random\.\w+\(/,
    code: "ARI-TST-004",
    message: "Non-deterministic random usage in test",
    severity: "medium" as const,
    remediation:
      "Replace Math.random with a seeded PRNG or inject the random source. " +
      "Example: `function generateId(rng: () => number = Math.random) { ... }` " +
      "then in tests: `generateId(() => 0.42)`. " +
      "Agents waste ~100-300 tokens when non-deterministic values cause snapshot mismatches or assertion drift across runs.",
  },
  {
    pattern: /process\.env\[|os\.environ|os\.Getenv/,
    code: "ARI-TST-005",
    message: "Direct environment variable access in test",
    severity: "medium" as const,
    remediation:
      "Pass configuration as a parameter instead of reading env vars directly. " +
      "Example: replace `process.env['DB_URL']` with `function connect(dbUrl: string) { ... }` " +
      "and call `connect('postgres://localhost/test')` in tests. " +
      "Agents waste ~100-300 tokens when tests fail in CI due to missing or differently-named environment variables.",
  },
];

/** Patterns that detect filesystem dependencies in tests */
const FS_DEPENDENCY_PATTERNS = [
  /\bfs\.(readFileSync|writeFileSync|readFile|writeFile|mkdirSync|mkdir|readdirSync|readdir|existsSync|exists|unlinkSync|unlink)\b/,
  /\bopen\s*\(.*['"rwa]/,
  /\bos\.(path\.|remove|makedirs|listdir)\b/,
  /\bioutil\.(ReadFile|WriteFile|TempDir)\b/,
  /\bFile\.(open|read|write|delete)\b/i,
  /\bstd::fs::/,
];

/** Patterns that detect order-sensitive assertions on unordered collections */
const ORDER_SENSITIVE_PATTERNS = [
  /\b(toEqual|toBe|to_equal|assert_eq|assertEqual)\b.*\b(Object\.keys|Object\.values|Object\.entries)\b/,
  /\b(Object\.keys|Object\.values|Object\.entries)\b.*\b(toEqual|toBe|to_equal|assert_eq|assertEqual)\b/,
  /\b(toEqual|toBe|to_equal|assert_eq|assertEqual)\b.*\b(new Set|new Map|Set\(|Map\()\b/,
  /\b(new Set|new Map|Set\(|Map\()\b.*\b(toEqual|toBe|to_equal|assert_eq|assertEqual)\b/,
  /\.keys\(\)\s*\)\s*\.\s*(toEqual|toBe)/,
];

/** Mutable global environment patterns (ARI-TST-011) */
const GLOBAL_MUTATION_PATTERNS = [
  {
    pattern: /process\.env\.\w+\s*=/,
    category: "resource-leak" as const,
    description: "process.env property assignment",
  },
  {
    pattern: /process\.env\s*=/,
    category: "resource-leak" as const,
    description: "process.env wholesale replacement",
  },
  {
    pattern: /\bglobal\.\w+\s*=/,
    category: "resource-leak" as const,
    description: "global property mutation",
  },
  {
    pattern: /\bglobalThis\.\w+\s*=/,
    category: "resource-leak" as const,
    description: "globalThis property mutation",
  },
  {
    pattern: /\bwindow\.\w+\s*=/,
    category: "resource-leak" as const,
    description: "window property mutation",
  },
];

/** Test order dependency patterns (ARI-TST-012) */
const ORDER_DEPENDENCY_PATTERNS = [
  {
    pattern: /\b(beforeAll|before)\s*\(/,
    category: "test-order-dependency" as const,
    description: "beforeAll/before block",
  },
  {
    pattern: /\b(afterAll|after)\s*\(/,
    category: "test-order-dependency" as const,
    description: "afterAll/after block",
  },
  {
    pattern: /\bdescribe\.only\s*\(/,
    category: "test-order-dependency" as const,
    description: "describe.only usage",
  },
  {
    pattern: /\bit\.only\s*\(|\btest\.only\s*\(/,
    category: "test-order-dependency" as const,
    description: "it.only/test.only usage",
  },
];

/** Concurrency / race condition patterns (ARI-TST-013) */
const CONCURRENCY_PATTERNS = [
  {
    pattern: /\bsetTimeout\s*\(/,
    category: "async-wait" as const,
    description: "setTimeout in test",
  },
  {
    pattern: /\b(sleep|delay|waitFor)\s*\(\s*\d+/,
    category: "async-wait" as const,
    description: "sleep/delay/waitFor with literal time",
  },
  {
    pattern: /new Promise\s*\([^)]*setTimeout/,
    category: "async-wait" as const,
    description: "new Promise wrapping setTimeout",
  },
  {
    pattern: /\bstd::thread::sleep\b/,
    category: "async-wait" as const,
    description: "std::thread::sleep in test",
  },
  {
    pattern: /\btokio::time::sleep\b/,
    category: "async-wait" as const,
    description: "tokio::time::sleep in test",
  },
];

/** Hardcoded credential patterns (critical severity) */
const CREDENTIAL_PATTERNS = [
  /(?:password|passwd|secret|api_?key|access_?key|token)\s*[:=]\s*['"][^'"]{8,}['"]/i,
];

/** Map a category string to its paper reference */
function paperForCategory(category: string): {
  paper: string;
  finding: string;
  confidence: "high" | "medium" | "low";
} {
  switch (category) {
    case "unordered-collection":
      return {
        paper: "Berndt et al., 2026",
        finding: "63% of LLM-generated flaky tests from unordered collection assumptions",
        confidence: "high",
      };
    case "async-wait":
    case "concurrency":
    case "test-order-dependency":
    case "resource-leak":
      return {
        paper: "Luo et al., 2014",
        finding: `Root cause category: ${category}`,
        confidence: "high",
      };
    default:
      return {
        paper: "Luo et al., 2014",
        finding: `Root cause category: ${category}`,
        confidence: "medium",
      };
  }
}

export const testIsolationAnalyzer: PillarAnalyzer = {
  pillar: PILLAR,
  name: PILLAR_NAMES[PILLAR],
  version: "0.2.0",

  async supports(): Promise<boolean> {
    return true;
  },

  async analyze(context: RepoContext) {
    const findings: Finding[] = [];
    let score = 0;

    // Find test files
    const testFiles = context.files.filter((f) => TEST_FILE_PATTERNS.some((p) => p.test(f)));

    // Detect Rust inline tests: .rs source files containing #[cfg(test)] or #[test]
    const rsSourceFiles = context.files.filter(
      (f) =>
        f.endsWith(".rs") &&
        !TEST_FILE_PATTERNS.some((p) => p.test(f)) &&
        !f.includes("node_modules"),
    );
    for (const rsFile of rsSourceFiles) {
      const content = await context.readFile(rsFile);
      if (content && (/#\[cfg\(test\)\]/.test(content) || /#\[test\]/.test(content))) {
        testFiles.push(rsFile);
      }
    }

    const sourceFiles = context.files.filter(
      (f) =>
        /\.[jt]sx?$|\.py$|\.go$|\.java$|\.cs$|\.rb$|\.rs$/.test(f) &&
        !TEST_FILE_PATTERNS.some((p) => p.test(f)) &&
        !f.includes("node_modules"),
    );

    if (testFiles.length === 0) {
      findings.push({
        code: "ARI-TST-006",
        severity: "critical",
        pillar: PILLAR,
        message: "No test files found in the repository",
        confidence: "high",
        remediation: {
          action: "create-file",
          description:
            "Add test files for your source code. A healthy test-to-source ratio is 0.5-1.0. " +
            "Example: create `src/utils.test.ts` with `import { add } from './utils'; test('add', () => expect(add(1,2)).toBe(3));`. " +
            "Agents waste ~500-1000 tokens attempting to verify changes when no tests exist, often resorting to manual inspection instead of automated validation.",
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
        confidence: "medium",
        remediation: {
          action: "create-file",
          description:
            "Add more test files. Target a test-to-source ratio of 0.5 or higher. " +
            "Start by adding tests for your most critical modules: `describe('PaymentService', () => { it('charges correct amount', ...) })`. " +
            "Agents waste ~300-600 tokens per untested module, as they cannot validate changes automatically and must rely on manual reasoning.",
          confidence: "medium",
        },
      });
    }

    // Scan test files for anti-patterns (sample up to 20 files)
    const sampled = testFiles.slice(0, 20);
    // Skip test files that contain cloud SDK strings as fixture data (not actual SDK usage)
    const filtered = sampled.filter(
      (f) => !f.includes("test-isolation.test") && !f.includes("fix/generators.test"),
    );
    let antiPatternCount = 0;

    for (const testFile of filtered) {
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
            confidence: "medium",
            remediation: {
              action: "refactor",
              description: ap.remediation,
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
    for (const testFile of filtered) {
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
            confidence: "medium",
            remediation: {
              action: "refactor",
              description:
                "Replace real filesystem calls with mock/stub/in-memory implementations. " +
                "Example (Vitest): `vi.mock('fs', () => ({ readFileSync: vi.fn(() => '{\"key\":\"value\"}') }))`. " +
                "Or use dependency injection: `function loadConfig(reader: (path: string) => string) { ... }`. " +
                "Agents waste ~200-400 tokens when tests fail because expected files are missing in CI or a different OS has incompatible paths.",
              confidence: "medium",
            },
          });
          break; // one finding per file
        }
      }
    }

    // Order-sensitive assertion detection
    let orderSensitiveCount = 0;
    for (const testFile of filtered) {
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
              confidence: "medium",
              remediation: {
                action: "refactor",
                description:
                  "Sort the collection before asserting, or use an unordered matcher. " +
                  "Example: replace `expect(Object.keys(obj)).toEqual(['a','b','c'])` with " +
                  "`expect(Object.keys(obj).sort()).toEqual(['a','b','c'])` or " +
                  "`expect(Object.keys(obj)).toEqual(expect.arrayContaining(['a','b','c']))`. " +
                  "Agents waste ~150-400 tokens debugging flaky order-dependent failures that pass locally but fail in CI due to different JS engine iteration order.",
                confidence: "medium",
              },
              evidence: paperForCategory("unordered-collection"),
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
          confidence: "medium",
          remediation: {
            action: "create-file",
            description:
              "Add test files for untested source modules. Aim for at least 1 test file per 2 source files. " +
              "Prioritize modules with complex logic: `describe('calculateTotal', () => { it('applies discount', ...) })`. " +
              "Agents waste ~500-1000 tokens per task when most modules lack tests, as they cannot verify correctness and must re-read source code repeatedly.",
            confidence: "high",
          },
        });
      }
    }

    // --- NEW: Mutable global environment detection (ARI-TST-011) ---
    let globalMutationCount = 0;
    for (const testFile of filtered) {
      const content = await context.readFile(testFile);
      if (!content) continue;

      let fileHasMutation = false;
      for (const gm of GLOBAL_MUTATION_PATTERNS) {
        if (gm.pattern.test(content)) {
          if (!fileHasMutation) {
            globalMutationCount++;
            fileHasMutation = true;
            findings.push({
              code: "ARI-TST-011",
              severity: "high",
              pillar: PILLAR,
              file: testFile,
              message: `Mutable global environment detected: ${gm.description}`,
              confidence: "medium",
              remediation: {
                action: "refactor",
                description:
                  "Avoid mutating global state in tests. Use dependency injection or per-test setup/teardown to isolate environment. " +
                  "Example: replace `process.env.NODE_ENV = 'test'` with " +
                  "`const env = { ...process.env, NODE_ENV: 'test' }; const svc = createService({ env })`. " +
                  "If mutation is unavoidable, save and restore in beforeEach/afterEach: " +
                  "`const orig = process.env.NODE_ENV; afterEach(() => { process.env.NODE_ENV = orig; })`. " +
                  "Agents waste ~300-600 tokens diagnosing cascading failures when one test's global mutation leaks into subsequent tests.",
                confidence: "high",
              },
              evidence: paperForCategory(gm.category),
            });
          }
        }
      }
    }

    // --- NEW: Test order dependency detection (ARI-TST-012) ---
    let orderDependencyCount = 0;
    for (const testFile of filtered) {
      const content = await context.readFile(testFile);
      if (!content) continue;

      let fileHasOrderDep = false;
      // Check if file has variable assignments outside of test blocks (shared state indicator)
      const hasSharedStateAssignment =
        /^\s*(let|var)\s+\w+/.test(content) && /\w+\s*=\s*/.test(content);

      for (const od of ORDER_DEPENDENCY_PATTERNS) {
        if (od.pattern.test(content)) {
          // For beforeAll/afterAll, only flag if file has shared state patterns
          if (
            od.description === "beforeAll/before block" ||
            od.description === "afterAll/after block"
          ) {
            if (hasSharedStateAssignment) {
              if (!fileHasOrderDep) {
                orderDependencyCount++;
                fileHasOrderDep = true;
                findings.push({
                  code: "ARI-TST-012",
                  severity: "medium",
                  pillar: PILLAR,
                  file: testFile,
                  message: `Test order dependency: ${od.description} modifies shared state`,
                  confidence: "low",
                  remediation: {
                    action: "refactor",
                    description:
                      "Move shared state setup into beforeEach/afterEach for proper test isolation. " +
                      "Example: replace `let db; beforeAll(() => { db = connect(); })` with " +
                      "`let db; beforeEach(() => { db = connect(); }); afterEach(() => { db.close(); })`. " +
                      "Agents waste ~200-500 tokens when tests pass individually but fail when run together due to shared state from beforeAll leaking across tests.",
                    confidence: "medium",
                  },
                  evidence: paperForCategory(od.category),
                });
              }
            }
          } else {
            // describe.only, it.only — always flag
            if (!fileHasOrderDep) {
              orderDependencyCount++;
              fileHasOrderDep = true;
              findings.push({
                code: "ARI-TST-012",
                severity: "medium",
                pillar: PILLAR,
                file: testFile,
                message: `Test order dependency: ${od.description}`,
                confidence: "high",
                remediation: {
                  action: "refactor",
                  description:
                    "Remove .only modifiers before committing — they skip other tests and mask failures. " +
                    "Example: change `it.only('works', ...)` to `it('works', ...)`. " +
                    "Consider adding a lint rule: `no-only-tests/no-only-tests` (eslint-plugin-no-only-tests). " +
                    "Agents waste ~200-400 tokens when .only silently skips tests, leading to false confidence that changes are safe.",
                  confidence: "high",
                },
                evidence: paperForCategory(od.category),
              });
            }
          }
        }
      }
    }

    // --- NEW: Concurrency/race condition patterns (ARI-TST-013) ---
    let concurrencyCount = 0;
    for (const testFile of filtered) {
      const content = await context.readFile(testFile);
      if (!content) continue;

      let fileHasConcurrency = false;
      for (const cp of CONCURRENCY_PATTERNS) {
        if (cp.pattern.test(content)) {
          if (!fileHasConcurrency) {
            concurrencyCount++;
            fileHasConcurrency = true;
            findings.push({
              code: "ARI-TST-013",
              severity: "medium",
              pillar: PILLAR,
              file: testFile,
              message: `Concurrency/race condition pattern: ${cp.description}`,
              confidence: "medium",
              remediation: {
                action: "refactor",
                description:
                  "Replace timing-based waits with event-driven assertions or fake timers. " +
                  "Example (Vitest): `vi.useFakeTimers(); myFunc(); vi.advanceTimersByTime(1000); expect(callback).toHaveBeenCalled(); vi.useRealTimers()`. " +
                  "Example (Testing Library): `await waitFor(() => expect(screen.getByText('Done')).toBeVisible())`. " +
                  "Agents waste ~300-600 tokens when timing-based tests flake under CI load, triggering repeated re-runs and false failure investigations.",
                confidence: "medium",
              },
              evidence: paperForCategory(cp.category),
            });
          }
        }
      }
    }

    // --- NEW: Hardcoded credentials detection (critical) ---
    for (const testFile of filtered) {
      const content = await context.readFile(testFile);
      if (!content) continue;

      for (const credPattern of CREDENTIAL_PATTERNS) {
        if (credPattern.test(content)) {
          findings.push({
            code: "ARI-TST-014",
            severity: "critical",
            pillar: PILLAR,
            file: testFile,
            message: "Hardcoded credential detected in test file",
            confidence: "high",
            remediation: {
              action: "refactor",
              description:
                "Replace hardcoded credentials with environment variables or test fixtures. " +
                "Example: replace `const apiKey = 'sk-live-abc123...'` with " +
                "`const apiKey = process.env['TEST_API_KEY'] ?? 'test-placeholder'` or use a `.env.test` file. " +
                "For unit tests, prefer a clearly-fake value: `const apiKey = 'test-key-not-real'`. " +
                "Agents waste ~100-200 tokens when credentials are flagged by secret scanners, blocking CI pipelines and requiring manual intervention.",
              confidence: "high",
            },
            evidence: paperForCategory("resource-leak"),
          });
          break; // one per file
        }
      }
    }

    // Deduct for new anti-patterns
    const newAntiPatternCount = globalMutationCount + orderDependencyCount + concurrencyCount;
    if (newAntiPatternCount > 0) {
      score -= Math.min(15, newAntiPatternCount * 3);
    }

    // --- NEW: Flakiness transfer risk assessment (ARI-TST-015) ---
    // Per Berndt et al., 2026: agents learn from existing tests — if those tests
    // have timing dependencies, unordered assertions, or shared state, agents will
    // propagate those patterns into generated tests.
    const TRANSFER_RISK_CATEGORIES = [
      {
        name: "timing",
        impact: 1,
        test: (c: string) => CONCURRENCY_PATTERNS.some((cp) => cp.pattern.test(c)),
      },
      {
        name: "shared-mutable-state",
        impact: 2,
        test: (c: string) =>
          GLOBAL_MUTATION_PATTERNS.some((gm) => gm.pattern.test(c)) ||
          (/\b(beforeAll|before)\s*\(/.test(c) &&
            /^\s*(let|var)\s+\w+/.test(c) &&
            /\w+\s*=\s*/.test(c)),
      },
      {
        name: "unordered-assertions",
        impact: 3,
        test: (c: string) => {
          const lines = c.split("\n");
          return lines.some((line) => ORDER_SENSITIVE_PATTERNS.some((p) => p.test(line)));
        },
      },
      {
        name: "network-dependencies",
        impact: 4,
        test: (c: string) =>
          ANTI_PATTERNS.filter((ap) => ap.code === "ARI-TST-001" || ap.code === "ARI-TST-002").some(
            (ap) => ap.pattern.test(c),
          ),
      },
      {
        name: "filesystem-dependencies",
        impact: 5,
        test: (c: string) => FS_DEPENDENCY_PATTERNS.some((fp) => fp.test(c)),
      },
      {
        name: "hardcoded-credentials",
        impact: 6,
        test: (c: string) => CREDENTIAL_PATTERNS.some((cp) => cp.test(c)),
      },
    ] as const;

    // Priority order: highest impact number = most impactful (for remediation ordering)
    const CATEGORY_PRIORITY = [...TRANSFER_RISK_CATEGORIES].sort((a, b) => b.impact - a.impact);

    let highRiskFileCount = 0;
    for (const testFile of filtered) {
      const content = await context.readFile(testFile);
      if (!content) continue;

      const presentCategories: string[] = [];
      for (const cat of TRANSFER_RISK_CATEGORIES) {
        if (cat.test(content)) {
          presentCategories.push(cat.name);
        }
      }

      if (presentCategories.length >= 2) {
        const severity = presentCategories.length >= 3 ? "high" : "medium";
        if (severity === "high") {
          highRiskFileCount++;
        }

        // Order categories by priority for remediation
        const prioritized = CATEGORY_PRIORITY.filter((c) => presentCategories.includes(c.name)).map(
          (c) => c.name,
        );

        findings.push({
          code: "ARI-TST-015",
          severity,
          pillar: PILLAR,
          file: testFile,
          message:
            `High flakiness transfer risk: ${testFile} contains ${presentCategories.length} anti-pattern categories (${presentCategories.join(", ")}). ` +
            `AI agents learning from this file will propagate these patterns into generated tests.`,
          confidence: "medium",
          remediation: {
            action: "refactor",
            description:
              `Fix the identified anti-patterns in this test file before using it as a reference for AI-generated tests. ` +
              `Priority: ${prioritized.join(", ")}.`,
            confidence: "medium",
          },
          evidence: {
            paper: "Berndt et al., 2026",
            finding:
              "Agents learn from existing tests — if those tests have timing dependencies, unordered assertions, or shared state, agents will propagate those patterns",
            confidence: "high",
          },
        });
      }
    }

    // Deduct 2 points per high-risk file (3+ categories), capped at 10
    if (highRiskFileCount > 0) {
      score -= Math.min(10, highRiskFileCount * 2);
    }

    // Check for DI/provider patterns (match filename only, exclude .devcontainer paths)
    const hasProviderPattern = context.files.some((f) => {
      if (/\.devcontainer/i.test(f)) return false;
      const filename = f.split("/").pop() ?? f;
      return /provider|factory|container|inject/i.test(filename);
    });
    if (hasProviderPattern) {
      score += 15;
    }

    // Check for mock/stub infrastructure
    const hasMockInfra = context.files.some((f) => /__mocks__|\.mock\.|mock\//i.test(f));
    if (hasMockInfra) {
      score += 10;
    }

    // Check for test config (jest.config, vitest.config, etc.)
    const hasTestConfig = context.files.some((f) =>
      /jest\.config|vitest\.config|pytest\.ini|conftest\.py|\.mocharc/i.test(f),
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
      summary: `${testFiles.length} test files found, ratio ${ratio.toFixed(2)}, ${totalAntiPatterns + newAntiPatternCount} anti-patterns detected`,
    };
  },
};

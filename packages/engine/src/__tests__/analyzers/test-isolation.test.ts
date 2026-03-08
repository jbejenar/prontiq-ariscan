import { describe, it, expect } from "vitest";
import { testIsolationAnalyzer } from "../../analyzers/test-isolation.js";
import { createMockContext } from "../helpers.js";

describe("testIsolationAnalyzer (P3)", () => {
  it("always reports pillar P3 with weight 0.18", async () => {
    const ctx = createMockContext({ "src/app.ts": "export const app = 1;" });
    const result = await testIsolationAnalyzer.analyze(ctx);
    expect(result.pillar).toBe("P3");
    expect(result.weight).toBe(0.18);
  });

  it("always supports any repo", async () => {
    const ctx = createMockContext({});
    expect(await testIsolationAnalyzer.supports(ctx)).toBe(true);
  });

  describe("repo with no test files", () => {
    it("returns score = 0", async () => {
      const ctx = createMockContext({
        "src/index.ts": "export const x = 1;",
        "src/utils.ts": "export function add(a: number, b: number) { return a + b; }",
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.score).toBe(0);
    });

    it("emits ARI-TST-006 finding", async () => {
      const ctx = createMockContext({
        "src/index.ts": "export const x = 1;",
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-TST-006")).toBe(true);
    });

    it("returns early with summary 'No test files found'", async () => {
      const ctx = createMockContext({
        "src/index.ts": "export const x = 1;",
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.summary).toBe("No test files found");
    });
  });

  describe("repo with test files and good ratio", () => {
    it("scores higher with good test-to-source ratio", async () => {
      const files: Record<string, string> = {};
      // 4 source files
      for (let i = 0; i < 4; i++) {
        files[`src/module${i}.ts`] = `export const mod${i} = ${i};`;
      }
      // 4 test files (ratio = 1.0)
      for (let i = 0; i < 4; i++) {
        files[`src/module${i}.test.ts`] = `import { mod${i} } from './module${i}'; test('works', () => {});`;
      }
      const ctx = createMockContext(files);
      const result = await testIsolationAnalyzer.analyze(ctx);
      // ratio 1.0 >= 0.8 -> 25 points, 0 anti-patterns -> 30 points = 55 minimum
      expect(result.score).toBeGreaterThanOrEqual(55);
    });

    it("gives lower ratio points for sparse tests", async () => {
      const files: Record<string, string> = {};
      // 10 source files
      for (let i = 0; i < 10; i++) {
        files[`src/module${i}.ts`] = `export const mod${i} = ${i};`;
      }
      // 1 test file (ratio = 0.1)
      files["src/module0.test.ts"] = "test('works', () => {});";

      const ctx = createMockContext(files);
      const result = await testIsolationAnalyzer.analyze(ctx);
      // ratio 0.1 < 0.2 -> 5 points + ARI-TST-007
      expect(result.findings.some((f) => f.code === "ARI-TST-007")).toBe(true);
    });
  });

  describe("tests containing cloud SDK references", () => {
    it("emits ARI-TST-001 findings for AWS references", async () => {
      const ctx = createMockContext({
        "src/service.ts": "export class S3Service {}",
        "src/service.test.ts": `
          import { S3Client } from '@aws-sdk/client-s3';
          test('uploads file', () => { const client = new S3Client({}); });
        `,
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-TST-001")).toBe(true);
    });

    it("emits ARI-TST-001 for Azure references", async () => {
      const ctx = createMockContext({
        "src/service.ts": "export class BlobService {}",
        "src/service.test.ts": `
          import { BlobServiceClient } from '@azure/storage-blob';
          test('reads blob', () => { Azure.connect(); });
        `,
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-TST-001")).toBe(true);
    });

    it("emits ARI-TST-002 for direct HTTP calls in tests", async () => {
      const ctx = createMockContext({
        "src/api.ts": "export function fetchData() {}",
        "src/api.test.ts": `
          test('fetches data', async () => {
            const res = await fetch('https://api.example.com/data');
          });
        `,
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-TST-002")).toBe(true);
    });

    it("reduces score with many anti-patterns", async () => {
      const cleanFiles: Record<string, string> = {
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": "test('clean test', () => { expect(1).toBe(1); });",
      };
      const dirtyFiles: Record<string, string> = {
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": `
          test('dirty', () => {
            const aws = new AWS.S3();
            fetch('http://api.example.com');
            const now = Date.now();
            const rand = Math.random();
            const env = process.env['KEY'];
          });
        `,
      };

      const cleanResult = await testIsolationAnalyzer.analyze(createMockContext(cleanFiles));
      const dirtyResult = await testIsolationAnalyzer.analyze(createMockContext(dirtyFiles));
      expect(cleanResult.score).toBeGreaterThan(dirtyResult.score);
    });
  });

  describe("DI / provider / factory patterns", () => {
    it("adds points when provider/factory files exist", async () => {
      // Use enough test files to keep ratio stable in the same bracket
      const baseFiles: Record<string, string> = {};
      for (let i = 0; i < 5; i++) {
        baseFiles[`src/mod${i}.ts`] = `export const m${i} = ${i};`;
        baseFiles[`src/mod${i}.test.ts`] = "test('works', () => {});";
      }

      const withDI: Record<string, string> = {
        ...baseFiles,
        "src/container/provider.ts": "export class ServiceProvider {}",
      };

      const diResult = await testIsolationAnalyzer.analyze(createMockContext(withDI));
      const noDiResult = await testIsolationAnalyzer.analyze(createMockContext(baseFiles));
      // Provider pattern adds 15 points (ratio stays in same bracket since 5/6 >= 0.8)
      expect(diResult.score - noDiResult.score).toBe(15);
    });
  });

  describe("mock infrastructure", () => {
    it("adds points for __mocks__ directory", async () => {
      // Use enough test files to keep ratio stable when __mocks__/fs.ts is added as source
      const baseFiles: Record<string, string> = {};
      for (let i = 0; i < 5; i++) {
        baseFiles[`src/mod${i}.ts`] = `export const m${i} = ${i};`;
        baseFiles[`src/mod${i}.test.ts`] = "test('works', () => {});";
      }

      const withMocks: Record<string, string> = {
        ...baseFiles,
        "__mocks__/fs.ts": "export const readFile = jest.fn();",
      };

      const mockResult = await testIsolationAnalyzer.analyze(createMockContext(withMocks));
      const noMockResult = await testIsolationAnalyzer.analyze(createMockContext(baseFiles));
      // Mock infra adds 10 points (ratio stays in same bracket since 5/6 >= 0.8)
      expect(mockResult.score - noMockResult.score).toBe(10);
    });

    it("detects .mock. file pattern", async () => {
      const ctx = createMockContext({
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": "test('works', () => {});",
        "src/db.mock.ts": "export const mockDb = {};",
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      // The mock infra detection should have found .mock. pattern
      const withoutMock = await testIsolationAnalyzer.analyze(
        createMockContext({
          "src/app.ts": "export const app = 1;",
          "src/app.test.ts": "test('works', () => {});",
        }),
      );
      expect(result.score).toBeGreaterThan(withoutMock.score);
    });
  });

  describe("test config detection", () => {
    it("adds points for vitest.config presence", async () => {
      // Use enough test files to keep ratio stable when vitest.config.ts is added
      const baseFiles: Record<string, string> = {};
      for (let i = 0; i < 5; i++) {
        baseFiles[`src/mod${i}.ts`] = `export const m${i} = ${i};`;
        baseFiles[`src/mod${i}.test.ts`] = "test('works', () => {});";
      }

      const withConfig: Record<string, string> = {
        ...baseFiles,
        "vitest.config.ts": "export default {}",
      };

      const configResult = await testIsolationAnalyzer.analyze(createMockContext(withConfig));
      const noConfigResult = await testIsolationAnalyzer.analyze(createMockContext(baseFiles));
      // Test config adds 5 points (ratio stays stable since 5/6 >= 0.8)
      expect(configResult.score).toBeGreaterThan(noConfigResult.score);
    });
  });

  describe("score clamping", () => {
    it("never exceeds 100", async () => {
      const files: Record<string, string> = {};
      for (let i = 0; i < 5; i++) {
        files[`src/mod${i}.ts`] = `export const m${i} = ${i};`;
        files[`src/mod${i}.test.ts`] = "test('clean', () => { expect(1).toBe(1); });";
      }
      files["src/provider.ts"] = "export class Provider {}";
      files["__mocks__/db.ts"] = "export const mock = {};";
      files["jest.config.ts"] = "export default {};";

      const ctx = createMockContext(files);
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });
});

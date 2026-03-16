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
        files[`src/module${i}.test.ts`] =
          `import { mod${i} } from './module${i}'; test('works', () => {});`;
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
    it("adds points when provider/factory files exist (filename-based)", async () => {
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
      // Provider pattern adds 15 points for filename-only (no interface detected)
      expect(diResult.score - noDiResult.score).toBe(15);
    });

    it("awards bonus for abstracted interface in provider files", async () => {
      const baseFiles: Record<string, string> = {};
      for (let i = 0; i < 5; i++) {
        baseFiles[`src/mod${i}.ts`] = `export const m${i} = ${i};`;
        baseFiles[`src/mod${i}.test.ts`] = "test('works', () => {});";
      }

      const withAbstracted: Record<string, string> = {
        ...baseFiles,
        "src/storage/storage-provider.ts":
          "export interface StorageProvider { put(key: string, data: Buffer): Promise<void>; }",
      };
      const withPlain: Record<string, string> = {
        ...baseFiles,
        "src/container/provider.ts": "export class ServiceProvider {}",
      };

      const abstractedResult = await testIsolationAnalyzer.analyze(
        createMockContext(withAbstracted),
      );
      const plainResult = await testIsolationAnalyzer.analyze(createMockContext(withPlain));
      // Abstracted gets 20 points vs 15 for plain filename match
      expect(abstractedResult.score).toBeGreaterThan(plainResult.score);
    });

    it("emits ARI-TST-016 info for abstracted provider interfaces", async () => {
      const files: Record<string, string> = {
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": "test('works', () => {});",
        "src/services/db-provider.ts":
          "export interface DbProvider { query(sql: string): Promise<unknown>; }",
      };
      const result = await testIsolationAnalyzer.analyze(createMockContext(files));
      const finding = result.findings.find((f) => f.code === "ARI-TST-016");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("info");
      expect(finding?.message).toContain("abstraction");
    });

    it("detects abstract class patterns as abstracted interfaces", async () => {
      const files: Record<string, string> = {
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": "test('works', () => {});",
        "src/services/base-provider.ts":
          "export abstract class BaseService { abstract connect(): void; }",
      };
      const result = await testIsolationAnalyzer.analyze(createMockContext(files));
      const finding = result.findings.find((f) => f.code === "ARI-TST-016");
      expect(finding).toBeDefined();
    });

    it("detects abstraction in files without provider/factory in the name", async () => {
      const files: Record<string, string> = {
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": "test('works', () => {});",
        "src/storage.ts":
          "export interface StorageProvider { put(key: string, data: Buffer): Promise<void>; }",
      };
      const result = await testIsolationAnalyzer.analyze(createMockContext(files));
      const finding = result.findings.find((f) => f.code === "ARI-TST-016");
      expect(finding).toBeDefined();
      expect(finding?.message).toContain("abstraction");
    });

    it("does not award abstraction bonus for generic *Service/*Client in non-provider files", async () => {
      const files: Record<string, string> = {
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": "test('works', () => {});",
        "src/user.ts": "export interface UserService { getUser(id: string): Promise<unknown>; }",
        "src/api.ts": "export interface ApiClient { fetch(url: string): Promise<unknown>; }",
        "src/payment.ts":
          "export abstract class PaymentGateway { abstract charge(amount: number): void; }",
      };
      const result = await testIsolationAnalyzer.analyze(createMockContext(files));
      const finding = result.findings.find((f) => f.code === "ARI-TST-016");
      expect(finding).toBeUndefined();
    });

    it("still awards bonus for *Service in provider-named files", async () => {
      const files: Record<string, string> = {
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": "test('works', () => {});",
        "src/di/container.ts":
          "export interface DatabaseService { query(sql: string): Promise<unknown>; }",
      };
      const result = await testIsolationAnalyzer.analyze(createMockContext(files));
      const finding = result.findings.find((f) => f.code === "ARI-TST-016");
      expect(finding).toBeDefined();
    });
  });

  describe("direct SDK imports in tests (ARI-TST-017)", () => {
    it("penalizes direct SDK imports in test files", async () => {
      const cleanFiles: Record<string, string> = {
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": "test('works', () => { expect(1).toBe(1); });",
      };
      const sdkFiles: Record<string, string> = {
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts":
          "import { S3Client } from '@aws-sdk/client-s3';\ntest('works', () => {});",
      };

      const cleanResult = await testIsolationAnalyzer.analyze(createMockContext(cleanFiles));
      const sdkResult = await testIsolationAnalyzer.analyze(createMockContext(sdkFiles));
      expect(cleanResult.score).toBeGreaterThan(sdkResult.score);
    });

    it("emits ARI-TST-017 finding for direct SDK imports", async () => {
      const files: Record<string, string> = {
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts":
          "import { BlobServiceClient } from '@azure/storage-blob';\ntest('works', () => {});",
      };
      const result = await testIsolationAnalyzer.analyze(createMockContext(files));
      const finding = result.findings.find((f) => f.code === "ARI-TST-017");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("medium");
      expect(finding?.message).toContain("Direct SDK imports");
    });

    it("does not emit ARI-TST-017 when no SDK imports in tests", async () => {
      const files: Record<string, string> = {
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": "test('works', () => { expect(1).toBe(1); });",
      };
      const result = await testIsolationAnalyzer.analyze(createMockContext(files));
      expect(result.findings.some((f) => f.code === "ARI-TST-017")).toBe(false);
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

  describe("filesystem dependency detection", () => {
    it("emits ARI-TST-008 for fs.readFileSync in tests", async () => {
      const ctx = createMockContext({
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": `
          import fs from 'fs';
          test('reads config', () => {
            const data = fs.readFileSync('/etc/config.json', 'utf-8');
            expect(data).toBeTruthy();
          });
        `,
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-TST-008")).toBe(true);
    });

    it("emits ARI-TST-008 for fs.writeFile in tests", async () => {
      const ctx = createMockContext({
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": `
          import { writeFile } from 'fs';
          test('writes output', () => {
            fs.writeFile('/tmp/output.txt', 'data', () => {});
          });
        `,
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-TST-008")).toBe(true);
    });

    it("does not emit ARI-TST-008 for tests without fs access", async () => {
      const ctx = createMockContext({
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": "test('clean', () => { expect(1).toBe(1); });",
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-TST-008")).toBe(false);
    });
  });

  describe("order-sensitive assertion detection", () => {
    it("emits ARI-TST-009 for toEqual on Object.keys", async () => {
      const ctx = createMockContext({
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": `
          test('checks keys', () => {
            expect(Object.keys(obj)).toEqual(['a', 'b', 'c']);
          });
        `,
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-TST-009")).toBe(true);
    });

    it("does not emit ARI-TST-009 for plain array assertions", async () => {
      const ctx = createMockContext({
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": `
          test('checks values', () => {
            const arr = [1, 2, 3];
            expect(arr).toEqual([1, 2, 3]);
          });
        `,
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-TST-009")).toBe(false);
    });
  });

  describe("test file count ratio check", () => {
    it("emits ARI-TST-010 when test ratio is very low", async () => {
      const files: Record<string, string> = {};
      // 20 source files, 1 test file -> ratio 0.05
      for (let i = 0; i < 20; i++) {
        files[`src/module${i}.ts`] = `export const m${i} = ${i};`;
      }
      files["src/module0.test.ts"] = "test('works', () => {});";
      const ctx = createMockContext(files);
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-TST-010")).toBe(true);
    });

    it("does not emit ARI-TST-010 when ratio is adequate", async () => {
      const files: Record<string, string> = {};
      for (let i = 0; i < 5; i++) {
        files[`src/module${i}.ts`] = `export const m${i} = ${i};`;
        files[`src/module${i}.test.ts`] = "test('works', () => {});";
      }
      const ctx = createMockContext(files);
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-TST-010")).toBe(false);
    });
  });

  describe("mutable global environment detection (ARI-TST-011)", () => {
    it("detects process.env.X = assignment", async () => {
      const ctx = createMockContext({
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": `
          test('sets env', () => {
            process.env.NODE_ENV = 'test';
            expect(true).toBe(true);
          });
        `,
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-TST-011")).toBe(true);
    });

    it("detects process.env = wholesale replacement", async () => {
      const ctx = createMockContext({
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": `
          test('replaces env', () => {
            process.env = { NODE_ENV: 'test' };
          });
        `,
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-TST-011")).toBe(true);
    });

    it("detects global.X = mutation", async () => {
      const ctx = createMockContext({
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": `
          test('global mutation', () => {
            global.myVar = 42;
          });
        `,
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-TST-011")).toBe(true);
    });

    it("detects globalThis.X = mutation", async () => {
      const ctx = createMockContext({
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": `
          test('globalThis mutation', () => {
            globalThis.config = {};
          });
        `,
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-TST-011")).toBe(true);
    });

    it("detects window.X = mutation", async () => {
      const ctx = createMockContext({
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": `
          test('window mutation', () => {
            window.location = 'http://test.com';
          });
        `,
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-TST-011")).toBe(true);
    });

    it("does not emit ARI-TST-011 for clean tests", async () => {
      const ctx = createMockContext({
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": "test('clean', () => { expect(1).toBe(1); });",
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-TST-011")).toBe(false);
    });

    it("includes Luo 2014 evidence", async () => {
      const ctx = createMockContext({
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": `test('env', () => { process.env.FOO = 'bar'; });`,
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-TST-011");
      expect(finding?.evidence?.paper).toContain("Luo");
    });
  });

  describe("test order dependency detection (ARI-TST-012)", () => {
    it("detects describe.only", async () => {
      const ctx = createMockContext({
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": `
          describe.only('focused', () => {
            it('runs only this', () => {});
          });
        `,
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-TST-012")).toBe(true);
    });

    it("detects it.only", async () => {
      const ctx = createMockContext({
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": `
          describe('suite', () => {
            it.only('focused test', () => {});
          });
        `,
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-TST-012")).toBe(true);
    });

    it("detects test.only", async () => {
      const ctx = createMockContext({
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": `
          test.only('focused test', () => { expect(1).toBe(1); });
        `,
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-TST-012")).toBe(true);
    });

    it("detects beforeAll with shared state assignment", async () => {
      const ctx = createMockContext({
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": `
          let sharedData;
          beforeAll(() => {
            sharedData = setupDatabase();
          });
          test('uses shared', () => { expect(sharedData).toBeTruthy(); });
        `,
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-TST-012")).toBe(true);
    });

    it("does not emit ARI-TST-012 for clean tests", async () => {
      const ctx = createMockContext({
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": `
          describe('suite', () => {
            it('works', () => { expect(1).toBe(1); });
          });
        `,
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-TST-012")).toBe(false);
    });

    it("includes Luo 2014 evidence for order dependency", async () => {
      const ctx = createMockContext({
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": `describe.only('x', () => { it('y', () => {}); });`,
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-TST-012");
      expect(finding?.evidence?.paper).toContain("Luo");
    });
  });

  describe("concurrency/race condition detection (ARI-TST-013)", () => {
    it("detects setTimeout in tests", async () => {
      const ctx = createMockContext({
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": `
          test('waits', () => {
            setTimeout(() => {}, 1000);
          });
        `,
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-TST-013")).toBe(true);
    });

    it("detects sleep with literal time", async () => {
      const ctx = createMockContext({
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": `
          test('sleeps', async () => {
            await sleep(500);
          });
        `,
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-TST-013")).toBe(true);
    });

    it("detects waitFor with literal time", async () => {
      const ctx = createMockContext({
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": `
          test('waits for', async () => {
            await waitFor(3000);
          });
        `,
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-TST-013")).toBe(true);
    });

    it("detects new Promise with setTimeout", async () => {
      const ctx = createMockContext({
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": `
          test('promise timeout', async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
          });
        `,
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-TST-013")).toBe(true);
    });

    it("does not emit ARI-TST-013 for clean tests", async () => {
      const ctx = createMockContext({
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": "test('clean', () => { expect(1).toBe(1); });",
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-TST-013")).toBe(false);
    });

    it("includes async-wait evidence category", async () => {
      const ctx = createMockContext({
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": `test('t', () => { setTimeout(() => {}, 100); });`,
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-TST-013");
      expect(finding?.evidence?.paper).toContain("Luo");
      expect(finding?.evidence?.finding).toContain("async-wait");
    });
  });

  describe("hardcoded credentials (ARI-TST-014)", () => {
    it("detects hardcoded password in test", async () => {
      const ctx = createMockContext({
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": `
          test('login', () => {
            const password = 'supersecretpassword123';
          });
        `,
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-TST-014")).toBe(true);
    });

    it("detects hardcoded api_key in test", async () => {
      const ctx = createMockContext({
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": `
          test('api', () => {
            const api_key = 'sk-1234567890abcdef';
          });
        `,
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-TST-014")).toBe(true);
    });

    it("has critical severity", async () => {
      const ctx = createMockContext({
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": `test('x', () => { const secret = 'mysupersecretvalue12'; });`,
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-TST-014");
      expect(finding?.severity).toBe("critical");
    });
  });

  describe("Rust test detection", () => {
    it("detects Rust test files in tests/ directory", async () => {
      const ctx = createMockContext({
        "src/lib.rs": "pub fn add(a: i32, b: i32) -> i32 { a + b }",
        "tests/integration_test.rs": `
          use mylib::add;
          #[test]
          fn test_add() { assert_eq!(add(1, 2), 3); }
        `,
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      // Should find the test file and not report "No test files found"
      expect(result.findings.some((f) => f.code === "ARI-TST-006")).toBe(false);
      expect(result.summary).not.toBe("No test files found");
    });

    it("detects Rust inline tests via #[cfg(test)] in source files", async () => {
      const ctx = createMockContext({
        "src/lib.rs": `
          pub fn add(a: i32, b: i32) -> i32 { a + b }

          #[cfg(test)]
          mod tests {
              use super::*;
              #[test]
              fn test_add() { assert_eq!(add(1, 2), 3); }
          }
        `,
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      // The inline test should be detected — no "No test files found"
      expect(result.findings.some((f) => f.code === "ARI-TST-006")).toBe(false);
      expect(result.summary).not.toBe("No test files found");
    });

    it("detects Rust _test.rs files as test files", async () => {
      const ctx = createMockContext({
        "src/main.rs": "fn main() {}",
        "src/utils.rs": "pub fn helper() -> bool { true }",
        "src/utils_test.rs": `
          use super::utils::helper;
          #[test]
          fn test_helper() { assert!(helper()); }
        `,
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-TST-006")).toBe(false);
      expect(result.summary).not.toBe("No test files found");
    });

    it("detects std::thread::sleep as timing dependency in Rust test files", async () => {
      const ctx = createMockContext({
        "src/lib.rs": "pub fn work() {}",
        "tests/slow_test.rs": `
          use std::thread;
          use std::time::Duration;
          #[test]
          fn test_work() {
              std::thread::sleep(Duration::from_millis(500));
              assert!(true);
          }
        `,
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.findings.some((f) => f.code === "ARI-TST-013")).toBe(true);
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

    it("never goes below 0 even with many anti-patterns", async () => {
      const ctx = createMockContext({
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": `
          test('bad', () => {
            process.env.NODE_ENV = 'test';
            global.myVar = 1;
            window.loc = 'x';
            setTimeout(() => {}, 100);
            const password = 'supersecret123456';
          });
        `,
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe("flakiness transfer risk (ARI-TST-015)", () => {
    it("does not emit ARI-TST-015 for a file with 0-1 anti-pattern categories", async () => {
      const ctx = createMockContext({
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": `
          test('only timing', () => {
            setTimeout(() => {}, 100);
          });
        `,
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      // Only timing category (1 category) — should NOT emit ARI-TST-015
      expect(result.findings.some((f) => f.code === "ARI-TST-015")).toBe(false);
    });

    it("emits medium severity ARI-TST-015 for a file with 2 anti-pattern categories", async () => {
      const ctx = createMockContext({
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": `
          test('timing and network', async () => {
            setTimeout(() => {}, 100);
            const res = await fetch('https://api.example.com/data');
          });
        `,
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-TST-015");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("medium");
      expect(finding?.confidence).toBe("medium");
      expect(finding?.message).toContain("2 anti-pattern categories");
      expect(finding?.message).toContain("timing");
      expect(finding?.message).toContain("network-dependencies");
      expect(finding?.evidence?.paper).toBe("Berndt et al., 2026");
    });

    it("emits high severity ARI-TST-015 for a file with 3+ anti-pattern categories", async () => {
      const ctx = createMockContext({
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": `
          test('many problems', async () => {
            setTimeout(() => {}, 100);
            const res = await fetch('https://api.example.com/data');
            const data = fs.readFileSync('/tmp/test.json', 'utf-8');
          });
        `,
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      const finding = result.findings.find((f) => f.code === "ARI-TST-015");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("high");
      expect(finding?.message).toContain("3 anti-pattern categories");
      expect(finding?.message).toContain("AI agents learning from this file");
      // Remediation should list categories in priority order (most impactful first)
      expect(finding?.remediation?.description).toContain("Priority:");
      expect(finding?.remediation?.description).toContain("filesystem-dependencies");
    });

    it("deducts score for high-risk files (3+ categories)", async () => {
      const cleanFiles: Record<string, string> = {
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": "test('clean', () => { expect(1).toBe(1); });",
      };
      const riskyFiles: Record<string, string> = {
        "src/app.ts": "export const app = 1;",
        "src/app.test.ts": `
          test('risky', async () => {
            setTimeout(() => {}, 100);
            process.env.NODE_ENV = 'test';
            const res = await fetch('https://api.example.com/data');
          });
        `,
      };

      const cleanResult = await testIsolationAnalyzer.analyze(createMockContext(cleanFiles));
      const riskyResult = await testIsolationAnalyzer.analyze(createMockContext(riskyFiles));
      // The risky file has 3+ categories (timing, shared-mutable-state, network-dependencies)
      // so it should deduct points
      expect(cleanResult.score).toBeGreaterThan(riskyResult.score);
    });
  });
});

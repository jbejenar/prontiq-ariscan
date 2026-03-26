import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { scan, analyzeTokenBudget, createRepoContext } from "@prontiq/ariscan-engine";
import type { ScanResult } from "@prontiq/ariscan-schema";
import type { TokenBudgetResult } from "@prontiq/ariscan-engine";
import {
  extractScore,
  extractPillars,
  extractRecommendations,
  extractContextFiles,
  extractBudget,
} from "./resources/index.js";

/** Configuration for the MCP server. */
export interface McpServerConfig {
  /** Path to the repository to scan. */
  repoPath: string;
  /** Cache TTL in milliseconds. Default: 300_000 (5 minutes). */
  cacheTtlMs?: number;
  /** Scan timeout in milliseconds. Default: 60_000 (60 seconds). */
  scanTimeoutMs?: number;
}

/** Cached scan state. */
interface CachedScan {
  result: ScanResult;
  budget: TokenBudgetResult;
  timestamp: number;
}

/**
 * Create and configure an MCP server exposing read-only ARI readiness data.
 *
 * Resources:
 * - readiness://score — composite score and maturity level
 * - readiness://pillars — per-pillar scores and findings
 * - readiness://recommendations — prioritized action items
 * - readiness://context-files — discovered context file inventory
 * - readiness://budget — token budget analysis
 */
export function createMcpServer(config: McpServerConfig): McpServer {
  const { repoPath, cacheTtlMs = 300_000, scanTimeoutMs = 60_000 } = config;

  const server = new McpServer(
    {
      name: "ariscan",
      version: "0.35.0",
    },
    {
      capabilities: {
        resources: {},
      },
    },
  );

  let cached: CachedScan | null = null;

  async function getScanResult(): Promise<CachedScan> {
    const now = Date.now();
    if (cached && now - cached.timestamp < cacheTtlMs) {
      return cached;
    }

    const doScan = async () => {
      const result = await scan(repoPath);
      const context = await createRepoContext(repoPath);
      const budget = await analyzeTokenBudget(context);
      return { result, budget, timestamp: Date.now() };
    };

    let timer: ReturnType<typeof setTimeout> | undefined;
    cached = await Promise.race([
      doScan(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Scan timed out after ${scanTimeoutMs}ms`)),
          scanTimeoutMs,
        );
      }),
    ]).finally(() => {
      if (timer) clearTimeout(timer);
    });
    return cached;
  }

  // readiness://score
  server.resource(
    "readiness-score",
    "readiness://score",
    { description: "Composite ARI score and maturity level" },
    async () => {
      const { result } = await getScanResult();
      return {
        contents: [
          {
            uri: "readiness://score",
            mimeType: "application/json",
            text: JSON.stringify(extractScore(result), null, 2),
          },
        ],
      };
    },
  );

  // readiness://pillars
  server.resource(
    "readiness-pillars",
    "readiness://pillars",
    { description: "Per-pillar scores, findings, and summaries" },
    async () => {
      const { result } = await getScanResult();
      return {
        contents: [
          {
            uri: "readiness://pillars",
            mimeType: "application/json",
            text: JSON.stringify(extractPillars(result), null, 2),
          },
        ],
      };
    },
  );

  // readiness://recommendations
  server.resource(
    "readiness-recommendations",
    "readiness://recommendations",
    { description: "Prioritized action items sorted by score impact" },
    async () => {
      const { result } = await getScanResult();
      return {
        contents: [
          {
            uri: "readiness://recommendations",
            mimeType: "application/json",
            text: JSON.stringify(extractRecommendations(result), null, 2),
          },
        ],
      };
    },
  );

  // readiness://context-files
  server.resource(
    "readiness-context-files",
    "readiness://context-files",
    { description: "Inventory of discovered context files (metadata only)" },
    async () => {
      const { result } = await getScanResult();
      return {
        contents: [
          {
            uri: "readiness://context-files",
            mimeType: "application/json",
            text: JSON.stringify(extractContextFiles(result), null, 2),
          },
        ],
      };
    },
  );

  // readiness://budget
  server.resource(
    "readiness-budget",
    "readiness://budget",
    { description: "Token budget analysis with hotspots and compression recommendations" },
    async () => {
      const { budget } = await getScanResult();
      return {
        contents: [
          {
            uri: "readiness://budget",
            mimeType: "application/json",
            text: JSON.stringify(extractBudget(budget), null, 2),
          },
        ],
      };
    },
  );

  return server;
}

/** Start the MCP server with stdio transport. */
export async function startServer(config: McpServerConfig): Promise<void> {
  const server = createMcpServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

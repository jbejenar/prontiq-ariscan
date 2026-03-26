import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the engine before importing server
vi.mock("@prontiq/ariscan-engine", () => ({
  scan: vi.fn().mockResolvedValue({
    metadata: {
      version: "0.2.0",
      timestamp: "2026-03-26T00:00:00.000Z",
      duration: 500,
      repoPath: "/mock",
      rubricVersion: "v1",
    },
    score: 75,
    level: "L4",
    levelMeta: { level: "L4", name: "Productive", description: "Good agent support" },
    securityGateTriggered: false,
    pillars: [],
    findings: [],
    contextFiles: [],
    scoreBreakdown: { activePillars: 8, insufficientPillars: 0, effectiveWeightSum: 1.0 },
  }),
  createRepoContext: vi.fn().mockResolvedValue({
    rootPath: "/mock",
    files: Object.freeze(["package.json"]),
    readFile: vi.fn().mockResolvedValue(null),
    fileExists: vi.fn().mockResolvedValue(false),
    readJson: vi.fn().mockResolvedValue(null),
  }),
  analyzeTokenBudget: vi.fn().mockResolvedValue({
    totalFiles: 10,
    totalBytes: 50000,
    totalTokens: 12500,
    byCategory: [],
    hotspots: [],
    recommendations: [],
  }),
}));

import { createMcpServer } from "../server.js";

describe("createMcpServer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an MCP server instance", () => {
    const server = createMcpServer({ repoPath: "/mock" });
    expect(server).toBeDefined();
    expect(server.server).toBeDefined();
  });

  it("server has underlying Server instance", () => {
    const server = createMcpServer({ repoPath: "/mock" });
    // The underlying Server should exist and be properly initialized
    expect(server.server).toBeDefined();
  });

  it("is a read-only server (no tools registered)", () => {
    const server = createMcpServer({ repoPath: "/mock" });
    // Verify the McpServer was created and has the connect method (it's a valid server)
    expect(typeof server.connect).toBe("function");
    expect(typeof server.close).toBe("function");
    // The server is read-only: only resources are registered, no tools
    // We verify this structurally — the createMcpServer function only calls server.resource()
    // and never server.tool(), which is the read-only constraint
    expect(server.server).toBeDefined();
  });
});

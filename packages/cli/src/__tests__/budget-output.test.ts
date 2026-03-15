import { describe, it, expect } from "vitest";
import { formatBudgetJson } from "../output/budget.js";
import type { TokenBudgetResult } from "@prontiq/ariscan-engine";

const mockBudgetResult: TokenBudgetResult = {
  totalTokens: 50000,
  totalFiles: 100,
  totalBytes: 250000,
  byCategory: [
    { category: "source", fileCount: 40, totalTokens: 20000, totalBytes: 100000, percentage: 40 },
    { category: "test", fileCount: 20, totalTokens: 10000, totalBytes: 50000, percentage: 20 },
    { category: "docs", fileCount: 10, totalTokens: 5000, totalBytes: 25000, percentage: 10 },
    { category: "config", fileCount: 15, totalTokens: 3000, totalBytes: 15000, percentage: 6 },
    { category: "other", fileCount: 15, totalTokens: 12000, totalBytes: 60000, percentage: 24 },
  ],
  hotspots: [
    { path: "src/large-file.ts", estimatedTokens: 5000, bytes: 20000, category: "source" },
    { path: "package-lock.json", estimatedTokens: 8000, bytes: 32000, category: "lockfile" },
  ],
  recommendations: [
    {
      description: "Add lockfiles to .agentignore",
      priority: "high",
      estimatedSavingsTokens: 8000,
      targetFiles: ["package-lock.json"],
    },
  ],
};

describe("formatBudgetJson", () => {
  it("produces valid JSON", () => {
    const output = formatBudgetJson(mockBudgetResult);
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it("includes all budget fields", () => {
    const parsed = JSON.parse(formatBudgetJson(mockBudgetResult));
    expect(parsed.totalTokens).toBe(50000);
    expect(parsed.totalFiles).toBe(100);
    expect(parsed.totalBytes).toBe(250000);
    expect(parsed.byCategory).toHaveLength(5);
    expect(parsed.hotspots).toHaveLength(2);
    expect(parsed.recommendations).toHaveLength(1);
  });

  it("preserves category breakdown data", () => {
    const parsed = JSON.parse(formatBudgetJson(mockBudgetResult));
    const source = parsed.byCategory.find((c: Record<string, unknown>) => c.category === "source");
    expect(source).toBeDefined();
    expect(source.fileCount).toBe(40);
    expect(source.totalTokens).toBe(20000);
  });

  it("preserves recommendation structure", () => {
    const parsed = JSON.parse(formatBudgetJson(mockBudgetResult));
    const rec = parsed.recommendations[0];
    expect(rec.priority).toBe("high");
    expect(rec.estimatedSavingsTokens).toBe(8000);
    expect(rec.targetFiles).toContain("package-lock.json");
  });
});

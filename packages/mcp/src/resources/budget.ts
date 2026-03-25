import type { TokenBudgetResult } from "@prontiq/ariscan-engine";

/** Token budget analysis — category totals, hotspots, compression recommendations. */
export function extractBudget(budget: TokenBudgetResult): {
  totalTokens: number;
  totalFiles: number;
  totalBytes: number;
  categories: Array<{
    category: string;
    fileCount: number;
    totalBytes: number;
    totalTokens: number;
    percentage: number;
  }>;
  hotspots: Array<{
    path: string;
    category: string;
    estimatedTokens: number;
  }>;
  recommendations: Array<{
    description: string;
    targetFiles: string[];
    estimatedSavingsTokens: number;
    priority: string;
  }>;
} {
  return {
    totalTokens: budget.totalTokens,
    totalFiles: budget.totalFiles,
    totalBytes: budget.totalBytes,
    categories: budget.byCategory.map((c) => ({
      category: c.category,
      fileCount: c.fileCount,
      totalBytes: c.totalBytes,
      totalTokens: c.totalTokens,
      percentage: c.percentage,
    })),
    hotspots: budget.hotspots.map((h) => ({
      path: h.path,
      category: h.category,
      estimatedTokens: h.estimatedTokens,
    })),
    recommendations: budget.recommendations.map((r) => ({
      description: r.description,
      targetFiles: r.targetFiles,
      estimatedSavingsTokens: r.estimatedSavingsTokens,
      priority: r.priority,
    })),
  };
}

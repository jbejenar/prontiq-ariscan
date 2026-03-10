/**
 * Context Budget Analyzer (P2.04)
 *
 * Analyzes a repository's token footprint by category, identifies waste hotspots,
 * and provides compression recommendations ranked by estimated savings.
 */

import type { RepoContext } from "../analyzers/analyzer.interface.js";
import {
  classifyFile,
  estimateTokens,
  type FileCategory,
  type FileTokenEstimate,
  type CategoryBudget,
  type CompressionRecommendation,
  type TokenBudgetResult,
} from "./token-estimator.js";

/** Maximum number of hotspot files to report. */
const MAX_HOTSPOTS = 20;

/**
 * Analyze the token budget of a repository.
 *
 * Walks all files in the RepoContext, estimates token counts per file,
 * aggregates by category, and produces compression recommendations.
 */
export async function analyzeTokenBudget(context: RepoContext): Promise<TokenBudgetResult> {
  const fileEstimates: FileTokenEstimate[] = [];

  // Estimate tokens for each file
  // Read file sizes in parallel (batched to avoid excessive concurrency)
  const batchSize = 50;
  for (let i = 0; i < context.files.length; i += batchSize) {
    const batch = context.files.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (filePath) => {
        const category = classifyFile(filePath);
        if (category === "binary") {
          return { path: filePath, category, bytes: 0, estimatedTokens: 0 };
        }

        const content = await context.readFile(filePath);
        if (content === null) {
          return { path: filePath, category, bytes: 0, estimatedTokens: 0 };
        }

        const bytes = Buffer.byteLength(content, "utf-8");
        const tokens = estimateTokens(bytes, category);
        return {
          path: filePath,
          category,
          bytes,
          estimatedTokens: tokens,
        } satisfies FileTokenEstimate;
      }),
    );
    fileEstimates.push(...results);
  }

  // Aggregate by category
  const categoryMap = new Map<
    FileCategory,
    { fileCount: number; totalBytes: number; totalTokens: number }
  >();
  let totalBytes = 0;
  let totalTokens = 0;

  for (const est of fileEstimates) {
    totalBytes += est.bytes;
    totalTokens += est.estimatedTokens;

    const existing = categoryMap.get(est.category);
    if (existing) {
      existing.fileCount++;
      existing.totalBytes += est.bytes;
      existing.totalTokens += est.estimatedTokens;
    } else {
      categoryMap.set(est.category, {
        fileCount: 1,
        totalBytes: est.bytes,
        totalTokens: est.estimatedTokens,
      });
    }
  }

  const byCategory: CategoryBudget[] = [];
  for (const [category, data] of categoryMap) {
    byCategory.push({
      category,
      ...data,
      percentage: totalTokens > 0 ? Math.round((data.totalTokens / totalTokens) * 1000) / 10 : 0,
    });
  }
  // Sort by token count descending
  byCategory.sort((a, b) => b.totalTokens - a.totalTokens);

  // Identify hotspots (top files by token count, excluding binaries)
  const hotspots = fileEstimates
    .filter((f) => f.estimatedTokens > 0)
    .sort((a, b) => b.estimatedTokens - a.estimatedTokens)
    .slice(0, MAX_HOTSPOTS);

  // Generate compression recommendations
  const recommendations = generateRecommendations(fileEstimates, categoryMap);

  return {
    totalFiles: fileEstimates.length,
    totalBytes,
    totalTokens,
    byCategory,
    hotspots,
    recommendations,
  };
}

/** Generate compression recommendations based on analysis. */
function generateRecommendations(
  files: FileTokenEstimate[],
  categoryMap: Map<FileCategory, { fileCount: number; totalBytes: number; totalTokens: number }>,
): CompressionRecommendation[] {
  const recommendations: CompressionRecommendation[] = [];

  // 1. Lockfiles: suggest adding to .agentignore
  const lockfileData = categoryMap.get("lockfile");
  if (lockfileData && lockfileData.totalTokens > 0) {
    const lockfiles = files.filter((f) => f.category === "lockfile" && f.estimatedTokens > 0);
    recommendations.push({
      description:
        "Add lockfiles to .agentignore — they consume tokens but provide no useful signal to agents",
      targetFiles: lockfiles.map((f) => f.path),
      estimatedSavingsTokens: lockfileData.totalTokens,
      priority: lockfileData.totalTokens > 10000 ? "high" : "medium",
    });
  }

  // 2. Generated files: suggest adding to .agentignore
  const generatedData = categoryMap.get("generated");
  if (generatedData && generatedData.totalTokens > 1000) {
    const generated = files.filter((f) => f.category === "generated" && f.estimatedTokens > 0);
    recommendations.push({
      description:
        "Add generated files (.d.ts, .min.js, .map) to .agentignore — agents should read source, not build output",
      targetFiles: generated.map((f) => f.path),
      estimatedSavingsTokens: generatedData.totalTokens,
      priority: generatedData.totalTokens > 5000 ? "high" : "medium",
    });
  }

  // 3. Large data files: identify JSON/CSV files consuming excessive tokens
  const largeDataFiles = files
    .filter((f) => f.category === "data" && f.estimatedTokens > 5000)
    .sort((a, b) => b.estimatedTokens - a.estimatedTokens);

  if (largeDataFiles.length > 0) {
    const savings = largeDataFiles.reduce((sum, f) => sum + f.estimatedTokens, 0);
    recommendations.push({
      description:
        "Add large data files to .agentignore — JSON/CSV data rarely helps agents understand code",
      targetFiles: largeDataFiles.map((f) => f.path),
      estimatedSavingsTokens: savings,
      priority: savings > 10000 ? "high" : "medium",
    });
  }

  // 4. Build artifacts in scan path
  const buildArtifacts = categoryMap.get("build-artifact");
  if (buildArtifacts && buildArtifacts.totalTokens > 0) {
    const artifactFiles = files.filter(
      (f) => f.category === "build-artifact" && f.estimatedTokens > 0,
    );
    recommendations.push({
      description:
        "Exclude build artifacts from agent context — they duplicate source code information",
      targetFiles: artifactFiles.map((f) => f.path),
      estimatedSavingsTokens: buildArtifacts.totalTokens,
      priority: "high",
    });
  }

  // 5. Oversized documentation files
  const largeDocs = files
    .filter((f) => f.category === "docs" && f.estimatedTokens > 8000)
    .sort((a, b) => b.estimatedTokens - a.estimatedTokens);

  if (largeDocs.length > 0) {
    const savings = Math.round(largeDocs.reduce((sum, f) => sum + f.estimatedTokens, 0) * 0.3);
    recommendations.push({
      description:
        "Consider splitting or summarizing oversized documentation files — large docs saturate context windows (Liu et al., 2024)",
      targetFiles: largeDocs.map((f) => f.path),
      estimatedSavingsTokens: savings,
      priority: "medium",
    });
  }

  // Sort by savings descending
  recommendations.sort((a, b) => b.estimatedSavingsTokens - a.estimatedSavingsTokens);

  return recommendations;
}

/**
 * Format token count as a human-readable string.
 * e.g., 1234 → "1.2k", 1234567 → "1.2M"
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return String(tokens);
}

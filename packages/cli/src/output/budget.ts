import pc from "picocolors";
import type { TokenBudgetResult } from "@prontiq/ariscan-engine";
import { formatTokenCount } from "@prontiq/ariscan-engine";

function formatCategoryBreakdown(result: TokenBudgetResult): string[] {
  const lines: string[] = [];
  lines.push(pc.bold("  By Category:"));
  lines.push("");

  const maxNameLen = Math.max(...result.byCategory.map((c) => categoryLabel(c.category).length));

  for (const cat of result.byCategory) {
    if (cat.totalTokens === 0) continue;
    const label = categoryLabel(cat.category).padEnd(maxNameLen);
    const bar = tokenBar(cat.percentage);
    const tokens = formatTokenCount(cat.totalTokens).padStart(8);
    const pct = `${cat.percentage.toFixed(1)}%`.padStart(6);
    const files = `${cat.fileCount} files`.padStart(10);
    const color = categoryColor(cat.category);
    lines.push(`  ${color(label)}  ${bar}  ${tokens}  ${pct}  ${pc.dim(files)}`);
  }
  return lines;
}

function formatHotspots(hotspots: TokenBudgetResult["hotspots"]): string[] {
  if (hotspots.length === 0) return [];
  const lines: string[] = [];
  lines.push("");
  lines.push(pc.bold("  Top Token Consumers:"));
  lines.push("");

  for (const file of hotspots.slice(0, 10)) {
    const tokens = formatTokenCount(file.estimatedTokens).padStart(8);
    const cat = pc.dim(`[${file.category}]`);
    lines.push(`  ${tokens}  ${file.path}  ${cat}`);
  }
  return lines;
}

function priorityBadge(priority: string): string {
  if (priority === "high") return pc.red(`[${priority}]`);
  if (priority === "medium") return pc.yellow(`[${priority}]`);
  return pc.dim(`[${priority}]`);
}

function formatRecommendations(recommendations: TokenBudgetResult["recommendations"]): string[] {
  if (recommendations.length === 0) return [];
  const lines: string[] = [];
  lines.push("");
  lines.push(pc.bold("  Compression Recommendations:"));
  lines.push("");

  for (const rec of recommendations) {
    const savings = formatTokenCount(rec.estimatedSavingsTokens);
    lines.push(`  ${priorityBadge(rec.priority)} ${rec.description}`);
    lines.push(`    ${pc.green(`~${savings} tokens saved`)} · ${rec.targetFiles.length} file(s)`);
  }
  return lines;
}

/** Format a token budget result for terminal output. */
export function formatBudgetTerminal(result: TokenBudgetResult): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(pc.bold("  Token Budget Analysis"));
  lines.push(pc.dim("  ─────────────────────────────────────────────────────"));
  lines.push("");
  lines.push(
    `  Total: ${pc.bold(formatTokenCount(result.totalTokens))} tokens across ${result.totalFiles} files (${formatBytes(result.totalBytes)})`,
  );
  lines.push("");

  lines.push(...formatCategoryBreakdown(result));
  lines.push(...formatHotspots(result.hotspots));
  lines.push(...formatRecommendations(result.recommendations));

  lines.push("");
  return lines.join("\n");
}

/** Format a token budget result as JSON. */
export function formatBudgetJson(result: TokenBudgetResult): string {
  return JSON.stringify(result, null, 2) + "\n";
}

function tokenBar(percentage: number, width: number = 20): string {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return pc.green("█".repeat(filled)) + pc.dim("░".repeat(empty));
}

function categoryLabel(category: string): string {
  const labels: Record<string, string> = {
    source: "Source code",
    test: "Tests",
    docs: "Documentation",
    config: "Config",
    generated: "Generated",
    "build-artifact": "Build artifacts",
    lockfile: "Lockfiles",
    data: "Data files",
    binary: "Binary",
    other: "Other",
  };
  return labels[category] ?? category;
}

function categoryColor(category: string): (text: string) => string {
  switch (category) {
    case "source":
      return pc.green;
    case "test":
      return pc.cyan;
    case "docs":
      return pc.blue;
    case "lockfile":
      return pc.red;
    case "generated":
      return pc.yellow;
    case "build-artifact":
      return pc.red;
    default:
      return pc.dim;
  }
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${bytes} B`;
}

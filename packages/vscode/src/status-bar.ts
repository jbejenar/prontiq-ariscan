import type * as vscode from "vscode";
import type { ScanResult } from "./types.js";

const LEVEL_ICONS: Record<string, string> = {
  L1: "$(error)",
  L2: "$(warning)",
  L3: "$(info)",
  L4: "$(check)",
  L5: "$(star-full)",
};

/**
 * Create and return a status bar item showing the ARI composite score.
 */
export function createStatusBarItem(vscodeApi: typeof vscode): vscode.StatusBarItem {
  const item = vscodeApi.window.createStatusBarItem(vscodeApi.StatusBarAlignment.Right, 100);
  item.command = "ariscan.showPillarSummary";
  item.tooltip = "ARI Readiness Score — click for pillar breakdown";
  item.text = "$(shield) ARI: --";
  item.show();
  return item;
}

/**
 * Update the status bar item with scan results.
 */
export function updateStatusBar(item: vscode.StatusBarItem, report: ScanResult | null): void {
  if (!report) {
    item.text = "$(shield) ARI: --";
    item.tooltip = "ARI: No scan report loaded";
    return;
  }

  const icon = LEVEL_ICONS[report.level] ?? "$(shield)";
  item.text = `${icon} ARI: ${Math.round(report.score)} (${report.level})`;
  item.tooltip = buildTooltip(report);
}

function buildTooltip(report: ScanResult): string {
  const lines: string[] = [
    `ARI Score: ${Math.round(report.score)}/100 — ${report.levelMeta.name}`,
    "",
  ];

  for (const pillar of report.pillars) {
    const bar = scoreBar(pillar.score);
    lines.push(`${pillar.pillar} ${pillar.name}: ${Math.round(pillar.score)} ${bar}`);
  }

  if (report.securityGateTriggered) {
    lines.push("", "⚠ Security gate triggered — maturity capped at L2");
  }

  const unsuppressed = report.findings.filter((f) => !f.suppressed);
  lines.push("", `${unsuppressed.length} finding(s)`);

  return lines.join("\n");
}

function scoreBar(score: number): string {
  const filled = Math.round(score / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

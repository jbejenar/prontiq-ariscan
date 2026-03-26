import type * as vscode from "vscode";
import type { ScanResult } from "./types.js";

/**
 * Register all ARI commands.
 */
export function registerCommands(
  vscodeApi: typeof vscode,
  context: vscode.ExtensionContext,
  getReport: () => ScanResult | null,
  loadReport: (path: string) => Promise<void>,
  runScan: () => Promise<void>,
): void {
  context.subscriptions.push(
    vscodeApi.commands.registerCommand("ariscan.runScan", runScan),
    vscodeApi.commands.registerCommand("ariscan.importReport", async () => {
      const uris = await vscodeApi.window.showOpenDialog({
        canSelectFiles: true,
        canSelectMany: false,
        filters: { "JSON files": ["json"] },
        title: "Select ARI scan report",
      });
      const uri = uris?.[0];
      if (uri) {
        await loadReport(uri.fsPath);
      }
    }),
    vscodeApi.commands.registerCommand("ariscan.showPillarSummary", () => {
      const report = getReport();
      if (!report) {
        vscodeApi.window.showInformationMessage("ARI: No scan report loaded. Run a scan first.");
        return;
      }
      showPillarSummary(vscodeApi, report);
    }),
  );
}

function showPillarSummary(vscodeApi: typeof vscode, report: ScanResult): void {
  const panel = vscodeApi.window.createWebviewPanel(
    "ariPillarSummary",
    `ARI Score: ${Math.round(report.score)} (${report.level})`,
    vscodeApi.ViewColumn.Beside,
    { enableScripts: false },
  );

  panel.webview.html = buildSummaryHtml(report);
}

function buildSummaryHtml(report: ScanResult): string {
  const pillarRows = report.pillars
    .map((p) => {
      const findingCount = p.findings.filter((f) => !f.suppressed).length;
      const statusColor = getStatusColor(p.status ?? "needs-improvement");
      return `<tr>
        <td>${p.pillar}</td>
        <td>${p.name}</td>
        <td style="color:${statusColor};font-weight:bold">${Math.round(p.score)}</td>
        <td>${(p.weight * 100).toFixed(0)}%</td>
        <td>${findingCount}</td>
        <td>${p.summary}</td>
      </tr>`;
    })
    .join("\n");

  const gateWarning = report.securityGateTriggered
    ? `<p style="color:#e74c3c;font-weight:bold">Security gate triggered — maturity level capped at L2</p>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: var(--vscode-font-family, sans-serif); padding: 16px; color: var(--vscode-foreground, #ccc); background: var(--vscode-editor-background, #1e1e1e); }
    h1 { font-size: 1.4em; margin-bottom: 4px; }
    h2 { font-size: 1.1em; margin-top: 24px; }
    table { border-collapse: collapse; width: 100%; margin-top: 12px; }
    th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--vscode-editorGroup-border, #333); }
    th { font-weight: 600; }
    .meta { opacity: 0.7; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>ARI Score: ${Math.round(report.score)}/100 — ${report.levelMeta.name}</h1>
  <p class="meta">Level: ${report.level} | Scanned: ${report.metadata.timestamp} | Duration: ${report.metadata.duration}ms</p>
  ${gateWarning}

  <h2>Pillar Breakdown</h2>
  <table>
    <tr><th>ID</th><th>Pillar</th><th>Score</th><th>Weight</th><th>Findings</th><th>Summary</th></tr>
    ${pillarRows}
  </table>

  <h2>Top Recommendations</h2>
  <ol>
    ${getTopRecommendations(report)
      .map((r) => `<li><strong>${r.code}</strong>: ${r.message}</li>`)
      .join("\n    ")}
  </ol>
</body>
</html>`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "excellent":
      return "#27ae60";
    case "good":
      return "#2ecc71";
    case "needs-improvement":
      return "#f39c12";
    case "poor":
      return "#e74c3c";
    default:
      return "inherit";
  }
}

function getTopRecommendations(report: ScanResult): Array<{ code: string; message: string }> {
  return report.findings
    .filter((f) => !f.suppressed && f.scoreImpact)
    .sort((a, b) => (b.scoreImpact?.compositeDelta ?? 0) - (a.scoreImpact?.compositeDelta ?? 0))
    .slice(0, 5)
    .map((f) => ({ code: f.code, message: f.message }));
}

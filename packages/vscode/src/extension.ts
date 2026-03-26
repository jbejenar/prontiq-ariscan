import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
import { parseReport } from "./report-loader.js";
import { findingsToDiagnostics, groupByFile, DiagSeverity } from "./diagnostics.js";
import { createStatusBarItem, updateStatusBar } from "./status-bar.js";
import { AriCodeLensProvider } from "./codelens.js";
import { registerCommands } from "./commands.js";
import type { ScanResult } from "./types.js";

let currentReport: ScanResult | null = null;
let diagnosticCollection: vscode.DiagnosticCollection;
let statusBarItem: vscode.StatusBarItem;
let codeLensProvider: AriCodeLensProvider;
let fileWatcher: vscode.FileSystemWatcher | undefined;

export function activate(context: vscode.ExtensionContext): void {
  diagnosticCollection = vscode.languages.createDiagnosticCollection("ariscan");
  context.subscriptions.push(diagnosticCollection);

  statusBarItem = createStatusBarItem(vscode);
  context.subscriptions.push(statusBarItem);

  codeLensProvider = new AriCodeLensProvider(vscode);
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider({ scheme: "file" }, codeLensProvider),
  );

  registerCommands(
    vscode,
    context,
    () => currentReport,
    (reportPath: string) => loadReportFromPath(reportPath),
    () => runScan(),
  );

  // Try to load report on activation
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (workspaceRoot) {
    const config = vscode.workspace.getConfiguration("ariscan");
    const reportPath = config.get<string>("reportPath", "ariscan.json");
    const fullPath = path.resolve(workspaceRoot, reportPath);
    if (fs.existsSync(fullPath)) {
      loadReportFromPath(fullPath).catch(() => {
        // Report read/parse error on startup — silently ignore
      });
    }

    // Watch for report file changes
    const pattern = new vscode.RelativePattern(workspaceRoot, reportPath);
    fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
    fileWatcher.onDidChange(() => loadReportFromPath(fullPath));
    fileWatcher.onDidCreate(() => loadReportFromPath(fullPath));
    fileWatcher.onDidDelete(() => {
      currentReport = null;
      updateStatusBar(statusBarItem, null);
      codeLensProvider.setReport(null);
      diagnosticCollection.clear();
    });
    context.subscriptions.push(fileWatcher);
  }
}

export function deactivate(): void {
  fileWatcher?.dispose();
}

async function loadReportFromPath(reportPath: string): Promise<void> {
  let raw: string;
  try {
    raw = fs.readFileSync(reportPath, "utf-8");
  } catch {
    vscode.window.showWarningMessage(`ARI: Could not read report at ${reportPath}`);
    return;
  }

  const report = parseReport(raw);
  if (!report) {
    vscode.window.showWarningMessage("ARI: Invalid scan report format");
    return;
  }

  currentReport = report;
  updateStatusBar(statusBarItem, report);
  codeLensProvider.setReport(report);
  updateDiagnostics(report);

  const findingCount = report.findings.filter((f) => !f.suppressed).length;
  vscode.window.showInformationMessage(
    `ARI: Score ${Math.round(report.score)} (${report.level}) — ${findingCount} finding(s)`,
  );
}

function updateDiagnostics(report: ScanResult): void {
  diagnosticCollection.clear();

  const allDiagnostics = findingsToDiagnostics(report.findings);
  const grouped = groupByFile(allDiagnostics);
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";

  for (const [file, diags] of grouped) {
    const fullPath = path.isAbsolute(file) ? file : path.join(workspaceRoot, file);
    const uri = vscode.Uri.file(fullPath);
    const vscodeDiags = diags.map((d) => {
      const range = new vscode.Range(
        Math.max(0, d.line - 1),
        0,
        Math.max(0, d.line - 1),
        Number.MAX_SAFE_INTEGER,
      );
      const diag = new vscode.Diagnostic(range, d.message, toVscodeSeverity(d.severity));
      diag.code = d.code;
      diag.source = d.source;
      return diag;
    });
    diagnosticCollection.set(uri, vscodeDiags);
  }
}

function toVscodeSeverity(severity: DiagSeverity): vscode.DiagnosticSeverity {
  switch (severity) {
    case DiagSeverity.Error:
      return vscode.DiagnosticSeverity.Error;
    case DiagSeverity.Warning:
      return vscode.DiagnosticSeverity.Warning;
    case DiagSeverity.Information:
      return vscode.DiagnosticSeverity.Information;
    case DiagSeverity.Hint:
      return vscode.DiagnosticSeverity.Hint;
  }
}

async function runScan(): Promise<void> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showWarningMessage("ARI: No workspace folder open");
    return;
  }

  const config = vscode.workspace.getConfiguration("ariscan");
  const reportPath = config.get<string>("reportPath", "ariscan.json");
  const outputPath = path.join(workspaceRoot, reportPath);

  const terminal = vscode.window.createTerminal({ name: "ARI Scan" });
  terminal.show();
  terminal.sendText(`npx @prontiq/ariscan-cli . --json --output "${outputPath}"`);
}

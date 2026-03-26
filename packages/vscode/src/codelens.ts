import type * as vscode from "vscode";
import * as path from "node:path";
import type { ScanResult } from "./types.js";
import { findingsForFile, fileSummary } from "./report-loader.js";

/**
 * CodeLens provider that shows per-file ARI finding summaries.
 *
 * The vscode API is injected via constructor to avoid direct require()
 * and to keep the provider testable.
 */
export class AriCodeLensProvider implements vscode.CodeLensProvider {
  private report: ScanResult | null = null;
  private readonly onDidChange: vscode.EventEmitter<void>;
  private readonly vscodeApi: typeof vscode;
  readonly onDidChangeCodeLenses: vscode.Event<void>;

  constructor(vscodeApi: typeof vscode) {
    this.vscodeApi = vscodeApi;
    this.onDidChange = new vscodeApi.EventEmitter<void>();
    this.onDidChangeCodeLenses = this.onDidChange.event;
  }

  setReport(report: ScanResult | null): void {
    this.report = report;
    this.onDidChange.fire();
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    if (!this.report) return [];

    const folder = this.vscodeApi.workspace.getWorkspaceFolder(document.uri);
    if (!folder) return [];

    const relativePath = path.relative(folder.uri.fsPath, document.uri.fsPath).replace(/\\/g, "/");
    const summary = fileSummary(this.report, relativePath);
    if (!summary) return [];

    const fileFindings = findingsForFile(this.report, relativePath);
    const unsuppressed = fileFindings.filter((f) => !f.suppressed);

    const lenses: vscode.CodeLens[] = [];
    const CodeLens = this.vscodeApi.CodeLens;

    // Top-of-file summary lens
    const range = document.lineAt(0).range;
    lenses.push(
      new CodeLens(range, {
        title: summary,
        command: "ariscan.showPillarSummary",
        tooltip: `${unsuppressed.length} ARI finding(s) in this file`,
      }),
    );

    // Per-finding lenses at specific lines
    for (const finding of unsuppressed) {
      if (finding.line && finding.line > 0 && finding.line <= document.lineCount) {
        const line = document.lineAt(finding.line - 1).range;
        lenses.push(
          new CodeLens(line, {
            title: `${finding.code}: ${finding.message}`,
            command: "",
            tooltip: finding.remediation?.description ?? finding.message,
          }),
        );
      }
    }

    return lenses;
  }
}

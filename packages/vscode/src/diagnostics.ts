import type { Finding, Severity } from "./types.js";

/**
 * VS Code diagnostic severity values (mirrors vscode.DiagnosticSeverity).
 * Defined here to enable testing without the vscode module.
 */
export const enum DiagSeverity {
  Error = 0,
  Warning = 1,
  Information = 2,
  Hint = 3,
}

/**
 * A diagnostic entry ready for VS Code consumption.
 * Decoupled from vscode.Diagnostic so the mapping logic is testable.
 */
export interface AriDiagnostic {
  file: string;
  line: number;
  severity: DiagSeverity;
  message: string;
  code: string;
  source: string;
}

const SEVERITY_MAP: Record<Severity, DiagSeverity> = {
  critical: DiagSeverity.Error,
  high: DiagSeverity.Error,
  medium: DiagSeverity.Warning,
  low: DiagSeverity.Information,
  info: DiagSeverity.Hint,
};

/**
 * Map ARI severity to VS Code DiagnosticSeverity.
 */
export function mapSeverity(severity: Severity): DiagSeverity {
  return SEVERITY_MAP[severity];
}

/**
 * Convert ARI findings into diagnostic entries.
 * Only findings with a file reference are included.
 * Suppressed findings are excluded.
 */
export function findingsToDiagnostics(findings: Finding[]): AriDiagnostic[] {
  const diagnostics: AriDiagnostic[] = [];

  for (const finding of findings) {
    if (!finding.file || finding.suppressed) continue;

    const message = finding.remediation
      ? `${finding.message} — ${finding.remediation.description}`
      : finding.message;

    diagnostics.push({
      file: finding.file,
      line: finding.line ?? 1,
      severity: mapSeverity(finding.severity),
      message,
      code: finding.code,
      source: "ariscan",
    });
  }

  return diagnostics;
}

/**
 * Group diagnostics by file path.
 */
export function groupByFile(diagnostics: AriDiagnostic[]): Map<string, AriDiagnostic[]> {
  const grouped = new Map<string, AriDiagnostic[]>();

  for (const diag of diagnostics) {
    const existing = grouped.get(diag.file);
    if (existing) {
      existing.push(diag);
    } else {
      grouped.set(diag.file, [diag]);
    }
  }

  return grouped;
}

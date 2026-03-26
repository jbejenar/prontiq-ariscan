import type { ScanResult } from "./types.js";

/**
 * Parse a raw JSON string into a ScanResult.
 * Returns null if the JSON is invalid or doesn't look like an ARI report.
 */
export function parseReport(raw: string): ScanResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("score" in parsed) ||
    !("pillars" in parsed) ||
    !("findings" in parsed)
  ) {
    return null;
  }

  return parsed as ScanResult;
}

/**
 * Extract all findings that reference a specific file path.
 * Matches are relative-path based (finding.file compared to relativePath).
 */
export function findingsForFile(report: ScanResult, relativePath: string): ScanResult["findings"] {
  return report.findings.filter((f) => {
    if (!f.file) return false;
    // Normalize separators and compare
    const normalized = f.file.replace(/\\/g, "/");
    const target = relativePath.replace(/\\/g, "/");
    return (
      normalized === target ||
      normalized.endsWith("/" + target) ||
      target.endsWith("/" + normalized)
    );
  });
}

/**
 * Get a summary line for a file based on its findings.
 */
export function fileSummary(report: ScanResult, relativePath: string): string {
  const fileFindings = findingsForFile(report, relativePath);
  if (fileFindings.length === 0) return "";

  const unsuppressed = fileFindings.filter((f) => !f.suppressed);
  if (unsuppressed.length === 0) return "";

  const bySeverity = new Map<string, number>();
  for (const f of unsuppressed) {
    bySeverity.set(f.severity, (bySeverity.get(f.severity) ?? 0) + 1);
  }

  const parts: string[] = [];
  for (const sev of ["critical", "high", "medium", "low", "info"] as const) {
    const count = bySeverity.get(sev);
    if (count) parts.push(`${count} ${sev}`);
  }

  return `ARI: ${parts.join(", ")}`;
}

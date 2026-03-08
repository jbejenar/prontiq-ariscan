import type { ScanResult } from "@prontiq/schema";

/**
 * Format scan result as JSON.
 */
export function formatJson(result: ScanResult): string {
  return JSON.stringify(result, null, 2) + "\n";
}

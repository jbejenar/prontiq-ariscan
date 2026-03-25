import type { ScanResult } from "@prontiq/ariscan-schema";

/** Inventory of discovered context files — metadata only, no content. */
export function extractContextFiles(result: ScanResult): {
  contextFiles: Array<{
    path: string;
    type: string;
    size?: number;
    lineCount?: number;
    lastModified?: string;
    parseStatus?: string;
  }>;
} {
  return {
    contextFiles: (result.contextFiles ?? []).map((cf) => ({
      path: cf.path,
      type: cf.type,
      ...(cf.size != null ? { size: cf.size } : {}),
      ...(cf.lineCount != null ? { lineCount: cf.lineCount } : {}),
      ...(cf.lastModified ? { lastModified: cf.lastModified } : {}),
      ...(cf.parseStatus ? { parseStatus: cf.parseStatus } : {}),
    })),
  };
}

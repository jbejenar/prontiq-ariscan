import type { ScanResult } from "@prontiq/ariscan-schema";

/** Per-pillar summary without raw file content. Finding messages are metadata, not content. */
export function extractPillars(result: ScanResult): {
  pillars: Array<{
    pillar: string;
    name: string;
    score: number;
    weight: number;
    confidence: string;
    status?: string;
    summary: string;
    dataStatus?: string;
    findingCount: number;
    findings: Array<{
      code: string;
      severity: string;
      message: string;
      confidence?: string;
      applicability?: string;
      scoreImpact?: { pillarDelta: number; compositeDelta: number };
    }>;
  }>;
} {
  return {
    pillars: result.pillars.map((p) => ({
      pillar: p.pillar,
      name: p.name,
      score: p.score,
      weight: p.weight,
      confidence: p.confidence,
      ...(p.status ? { status: p.status } : {}),
      summary: p.summary,
      ...(p.dataStatus ? { dataStatus: p.dataStatus } : {}),
      findingCount: p.findings.length,
      findings: p.findings.map((f) => ({
        code: f.code,
        severity: f.severity,
        message: f.message,
        ...(f.confidence ? { confidence: f.confidence } : {}),
        ...(f.applicability ? { applicability: f.applicability } : {}),
        ...(f.scoreImpact ? { scoreImpact: f.scoreImpact } : {}),
      })),
    })),
  };
}

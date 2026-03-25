import type { ScanResult } from "@prontiq/ariscan-schema";

/** Prioritized action items sorted by composite score impact. */
export function extractRecommendations(result: ScanResult): {
  recommendations: Array<{
    code: string;
    pillar: string;
    severity: string;
    message: string;
    remediation?: {
      action: string;
      description: string;
      estimatedImpact?: string;
      confidence: string;
    };
    scoreImpact?: { pillarDelta: number; compositeDelta: number };
  }>;
} {
  // Collect all findings with remediation, sorted by composite delta (descending)
  const actionable = result.findings
    .filter((f) => f.remediation && !f.suppressed)
    .sort((a, b) => {
      const deltaA = a.scoreImpact?.compositeDelta ?? 0;
      const deltaB = b.scoreImpact?.compositeDelta ?? 0;
      return deltaB - deltaA;
    });

  return {
    recommendations: actionable.map((f) => ({
      code: f.code,
      pillar: f.pillar,
      severity: f.severity,
      message: f.message,
      ...(f.remediation
        ? {
            remediation: {
              action: f.remediation.action,
              description: f.remediation.description,
              ...(f.remediation.estimatedImpact
                ? { estimatedImpact: f.remediation.estimatedImpact }
                : {}),
              confidence: f.remediation.confidence,
            },
          }
        : {}),
      ...(f.scoreImpact ? { scoreImpact: f.scoreImpact } : {}),
    })),
  };
}

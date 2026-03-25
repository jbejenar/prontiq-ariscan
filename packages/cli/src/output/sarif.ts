import type { ScanResult, Finding } from "@prontiq/ariscan-schema";

const SARIF_SCHEMA =
  "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json";
const TOOL_NAME = "ariscan";
const TOOL_INFO_URI = "https://github.com/prontiq/ariscan";

interface SarifLevel {
  level: "error" | "warning" | "note" | "none";
}

function severityToSarifLevel(severity: string): SarifLevel["level"] {
  switch (severity) {
    case "critical":
    case "high":
      return "error";
    case "medium":
      return "warning";
    case "low":
    case "info":
      return "note";
    default:
      return "note";
  }
}

function buildRule(finding: Finding): Record<string, unknown> {
  const rule: Record<string, unknown> = {
    id: finding.code,
    shortDescription: { text: finding.message },
    helpUri: `https://prontiq.dev/docs/findings/${finding.code}`,
    properties: {
      pillar: finding.pillar,
      severity: finding.severity,
    },
  };

  if (finding.remediation) {
    rule["fullDescription"] = { text: finding.remediation.description };
    rule["help"] = {
      text: finding.remediation.description,
      markdown: `**Action:** ${finding.remediation.action}\n\n${finding.remediation.description}`,
    };
  }

  if (finding.evidence) {
    (rule["properties"] as Record<string, unknown>)["evidence"] = {
      paper: finding.evidence.paper,
      finding: finding.evidence.finding,
      confidence: finding.evidence.confidence,
    };
  }

  if (finding.scoreImpact) {
    (rule["properties"] as Record<string, unknown>)["scoreImpact"] = {
      pillarDelta: finding.scoreImpact.pillarDelta,
      compositeDelta: finding.scoreImpact.compositeDelta,
    };
  }

  return rule;
}

function buildResult(finding: Finding): Record<string, unknown> {
  const result: Record<string, unknown> = {
    ruleId: finding.code,
    level: severityToSarifLevel(finding.severity),
    message: { text: finding.message },
  };

  if (finding.file) {
    const region: Record<string, unknown> = {};
    if (finding.line) {
      region["startLine"] = finding.line;
    }
    result["locations"] = [
      {
        physicalLocation: {
          artifactLocation: {
            uri: finding.file,
            uriBaseId: "%SRCROOT%",
          },
          ...(Object.keys(region).length > 0 ? { region } : {}),
        },
      },
    ];
  }

  if (finding.remediation) {
    result["fixes"] = [
      {
        description: { text: finding.remediation.description },
      },
    ];
  }

  return result;
}

/**
 * Format scan result as SARIF 2.1.0 for integration with GitHub Code Scanning,
 * VS Code SARIF Viewer, and other SARIF-compatible tools.
 */
export function formatSarif(result: ScanResult): string {
  // Deduplicate rules by finding code
  const ruleMap = new Map<string, Record<string, unknown>>();
  for (const finding of result.findings) {
    if (!ruleMap.has(finding.code)) {
      ruleMap.set(finding.code, buildRule(finding));
    }
  }

  const sarif = {
    $schema: SARIF_SCHEMA,
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: TOOL_NAME,
            version: result.metadata.version,
            informationUri: TOOL_INFO_URI,
            rules: Array.from(ruleMap.values()),
            properties: {
              rubricVersion: result.metadata.rubricVersion,
            },
          },
        },
        results: [...result.findings]
          .sort(
            (a, b) => (b.scoreImpact?.compositeDelta ?? 0) - (a.scoreImpact?.compositeDelta ?? 0),
          )
          .map(buildResult),
        invocations: [
          {
            executionSuccessful: true,
            startTimeUtc: result.metadata.timestamp,
            properties: {
              score: result.score,
              level: result.level,
              levelName: result.levelMeta.name,
              securityGateTriggered: result.securityGateTriggered,
              durationMs: result.metadata.duration,
            },
          },
        ],
      },
    ],
  };

  return JSON.stringify(sarif, null, 2) + "\n";
}

import type { ScanResult } from "@prontiq/ariscan-schema";

const SCHEMA_ID = "https://prontiq.dev/schemas/ari-scan-result/v1.json";

/**
 * Format scan result as JSON with $schema / $id envelope.
 */
export function formatJson(result: ScanResult): string {
  const output = {
    $schema: SCHEMA_ID,
    $id: `ari-scan-${result.metadata.timestamp}`,
    ...result,
  };
  return JSON.stringify(output, null, 2) + "\n";
}

/**
 * Return the JSON Schema object for programmatic use, file generation,
 * and the `--json-schema` CLI flag so external tools can validate ARI scan output.
 */
export function getJsonSchemaObject(): Record<string, unknown> {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: SCHEMA_ID,
    title: "ARI Scan Result",
    description: "Output of the Prontiq ARI scan — Agent Readiness Index for a repository.",
    type: "object",
    required: [
      "metadata",
      "score",
      "level",
      "levelMeta",
      "securityGateTriggered",
      "pillars",
      "findings",
    ],
    properties: {
      $schema: { type: "string", description: "JSON Schema URI" },
      $id: { type: "string", description: "Unique scan identifier" },
      metadata: {
        type: "object",
        required: ["version", "timestamp", "duration", "repoPath"],
        properties: {
          version: { type: "string" },
          timestamp: { type: "string", format: "date-time" },
          duration: { type: "number", description: "Scan duration in ms" },
          repoPath: { type: "string" },
          rubricVersion: { type: "string", default: "v1" },
        },
      },
      score: { type: "number", minimum: 0, maximum: 100 },
      level: {
        type: "string",
        enum: ["L1", "L2", "L3", "L4", "L5"],
      },
      levelMeta: {
        type: "object",
        required: ["level", "name", "description"],
        properties: {
          level: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
        },
      },
      securityGateTriggered: { type: "boolean" },
      pillars: {
        type: "array",
        items: {
          type: "object",
          required: ["pillar", "name", "score", "weight", "confidence", "findings", "summary"],
          properties: {
            pillar: { type: "string" },
            name: { type: "string" },
            score: { type: "number", minimum: 0, maximum: 100 },
            weight: { type: "number", minimum: 0, maximum: 1 },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            findings: { type: "array", items: { $ref: "#/$defs/finding" } },
            summary: { type: "string" },
            status: {
              type: "string",
              enum: ["excellent", "good", "needs-improvement", "poor"],
              description:
                "Derived label: >=80 excellent, >=60 good, >=40 needs-improvement, <40 poor",
            },
          },
        },
      },
      findings: {
        type: "array",
        items: { $ref: "#/$defs/finding" },
      },
      detection: {
        type: "object",
        properties: {
          languages: {
            type: "array",
            items: {
              type: "object",
              properties: {
                language: { type: "string" },
                confidence: { type: "number" },
                primary: { type: "boolean" },
              },
            },
          },
          frameworks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                framework: { type: "string" },
                confidence: { type: "number" },
              },
            },
          },
          monorepo: {
            oneOf: [
              {
                type: "object",
                properties: {
                  tool: { type: "string" },
                  workspaceRoot: { type: "string" },
                  packages: { type: "array", items: { type: "string" } },
                },
              },
              { type: "null" },
            ],
          },
        },
      },
      contextFiles: {
        type: "array",
        items: {
          type: "object",
          required: ["path", "type"],
          properties: {
            path: { type: "string" },
            type: {
              type: "string",
              enum: [
                "agents-md",
                "claude-md",
                "cursorrules",
                "copilot-instructions",
                "aider-config",
                "agentignore",
                "mcp-config",
                "other",
              ],
            },
            size: { type: "number" },
            lineCount: { type: "number" },
            lastModified: { type: "string", format: "date-time" },
            parseStatus: {
              type: "string",
              enum: ["valid", "warning", "error"],
            },
          },
        },
      },
      devcontainerDetected: {
        type: "boolean",
        description: "Whether a devcontainer configuration was detected in the repository.",
      },
    },
    $defs: {
      finding: {
        type: "object",
        required: ["code", "severity", "pillar", "message"],
        properties: {
          code: { type: "string", pattern: "^ARI-[A-Z]{3}-\\d{3}$" },
          severity: {
            type: "string",
            enum: ["critical", "high", "medium", "low", "info"],
          },
          pillar: { type: "string" },
          file: { type: "string" },
          line: { type: "number" },
          message: { type: "string" },
          remediation: {
            type: "object",
            required: ["action", "description", "confidence"],
            properties: {
              action: {
                type: "string",
                enum: [
                  "create-file",
                  "modify-config",
                  "add-dependency",
                  "remove-dependency",
                  "refactor",
                  "add-script",
                  "configure-tool",
                ],
              },
              path: { type: "string" },
              description: { type: "string" },
              estimatedImpact: {
                type: "string",
                description: "Expected impact on ARI score, e.g. '+12 points composite'",
              },
              confidence: {
                type: "string",
                enum: ["high", "medium", "low"],
              },
            },
          },
          evidence: {
            type: "object",
            description: "Optional research citation supporting this finding.",
            required: ["paper", "finding", "confidence"],
            properties: {
              paper: { type: "string" },
              finding: { type: "string" },
              confidence: {
                type: "string",
                enum: ["high", "medium", "low"],
              },
            },
          },
          suppressed: {
            type: "boolean",
            description: "Whether this finding is suppressed by policy.",
          },
        },
      },
    },
  };
}

/**
 * Format scan result as NDJSON (newline-delimited JSON) for streaming.
 * Emits one JSON object per line:
 *   1. metadata record (type: "metadata")
 *   2. one record per pillar (type: "pillar")
 *   3. summary record (type: "summary")
 */
export function formatNdjson(result: ScanResult): string {
  const lines: string[] = [];

  // Line 1: metadata
  lines.push(
    JSON.stringify({
      type: "metadata",
      ...result.metadata,
    }),
  );

  // Lines 2-N: one per pillar
  for (const pillar of result.pillars) {
    lines.push(
      JSON.stringify({
        type: "pillar",
        ...pillar,
      }),
    );
  }

  // Final line: summary
  lines.push(
    JSON.stringify({
      type: "summary",
      score: result.score,
      level: result.level,
      levelMeta: result.levelMeta,
      securityGateTriggered: result.securityGateTriggered,
      findingsCount: result.findings.length,
      ...(result.detection ? { detection: result.detection } : {}),
    }),
  );

  return lines.join("\n") + "\n";
}

/** Serialize the JSON Schema as a formatted string. */
export function formatJsonSchema(): string {
  return JSON.stringify(getJsonSchemaObject(), null, 2) + "\n";
}

const CONFIG_SCHEMA_ID = "https://prontiq.dev/schemas/ariscan-config/v1.json";

const pillarIdEnum = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"];

/**
 * Return the JSON Schema object for `.ariscan.yml` policy config,
 * enabling IDE autocompletion and external validation.
 */
export function getConfigJsonSchemaObject(): Record<string, unknown> {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: CONFIG_SCHEMA_ID,
    title: "ARI Policy Config",
    description: "Schema for .ariscan.yml — policy configuration for the Prontiq ARI scanner.",
    type: "object",
    additionalProperties: false,
    properties: {
      $schema: { type: "string", description: "JSON Schema URI for IDE validation" },
      version: { type: "string", description: 'Policy schema version (e.g. "1")' },
      extends: {
        type: "string",
        description: "Path to a parent policy file to inherit from",
      },
      enforcement: { $ref: "#/$defs/enforcementMode" },
      threshold: {
        type: "number",
        minimum: 0,
        maximum: 100,
        description: "Shorthand for thresholds.composite (backward-compatible)",
      },
      thresholds: { $ref: "#/$defs/pillarThresholds" },
      format: {
        type: "string",
        enum: ["terminal", "json", "ndjson", "sarif", "markdown"],
        description: "Default output format override",
      },
      pillars: {
        type: "object",
        additionalProperties: false,
        properties: {
          exclude: {
            type: "array",
            items: { type: "string", enum: pillarIdEnum },
            description: "Pillar IDs to exclude from scanning",
          },
          weights: {
            $ref: "#/$defs/pillarWeightMap",
          },
        },
      },
      suppressions: {
        type: "array",
        items: { $ref: "#/$defs/suppression" },
        description: "Findings to suppress (audit-only, does not affect scores)",
      },
      profiles: {
        type: "object",
        additionalProperties: { $ref: "#/$defs/policyProfile" },
        description: "Named profiles with threshold/weight overrides",
      },
      activeProfile: {
        type: "string",
        description: "Name of the active profile to apply",
      },
      paths: {
        type: "array",
        items: { $ref: "#/$defs/pathRule" },
        description: "Path-specific rules (not yet enforced at runtime)",
      },
    },
    $defs: {
      enforcementMode: {
        type: "string",
        enum: ["warn", "fail", "block"],
        description:
          "warn: print warnings, exit 0; fail: exit 1 on violation; block: same as fail (for CI)",
      },
      pillarThresholds: {
        type: "object",
        additionalProperties: false,
        properties: {
          composite: {
            type: "number",
            minimum: 0,
            maximum: 100,
            description: "Minimum composite score",
          },
          pillars: {
            $ref: "#/$defs/pillarScoreMap",
          },
        },
      },
      pillarScoreMap: {
        type: "object",
        propertyNames: { enum: pillarIdEnum },
        additionalProperties: {
          type: "number",
          minimum: 0,
          maximum: 100,
        },
        description: "Per-pillar minimum scores (keys must be valid pillar IDs: P1–P8)",
      },
      pillarWeightMap: {
        type: "object",
        propertyNames: { enum: pillarIdEnum },
        additionalProperties: {
          type: "number",
          minimum: 0,
          maximum: 1,
        },
        description: "Per-pillar weights (keys must be valid pillar IDs: P1–P8, should sum to 1.0)",
      },
      suppression: {
        type: "object",
        required: ["code", "reason", "expiry"],
        additionalProperties: false,
        properties: {
          code: {
            type: "string",
            pattern: "^ARI-[A-Z]{3}-\\d{3}$",
            description: "Finding code to suppress (e.g. ARI-CTX-001)",
          },
          reason: {
            type: "string",
            minLength: 1,
            description: "Justification for suppression",
          },
          expiry: {
            oneOf: [
              { type: "string", format: "date", description: "ISO date (YYYY-MM-DD)" },
              { type: "string", const: "no-expiry" },
            ],
            description: 'Expiry date or "no-expiry"',
          },
          approver: {
            type: "string",
            description: "Who approved this suppression",
          },
        },
      },
      policyProfile: {
        type: "object",
        required: ["name"],
        additionalProperties: false,
        properties: {
          name: { type: "string", minLength: 1, description: "Display name" },
          thresholds: { $ref: "#/$defs/pillarThresholds" },
          weights: { $ref: "#/$defs/pillarWeightMap" },
        },
      },
      pathRule: {
        type: "object",
        required: ["pattern"],
        additionalProperties: false,
        properties: {
          pattern: {
            type: "string",
            minLength: 1,
            description: "Glob pattern for matching file paths",
          },
          thresholds: { $ref: "#/$defs/pillarThresholds" },
          enforcement: { $ref: "#/$defs/enforcementMode" },
        },
      },
    },
  };
}

/** Serialize the policy config JSON Schema as a formatted string. */
export function formatConfigJsonSchema(): string {
  return JSON.stringify(getConfigJsonSchemaObject(), null, 2) + "\n";
}

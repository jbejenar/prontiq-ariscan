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
        },
      },
    },
  };
}

/** Serialize the JSON Schema as a formatted string. */
export function formatJsonSchema(): string {
  return JSON.stringify(getJsonSchemaObject(), null, 2) + "\n";
}

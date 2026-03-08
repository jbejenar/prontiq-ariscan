import { type PillarId, PILLAR_NAMES, PILLAR_WEIGHTS, type Finding } from "@prontiq/schema";
import type { PillarAnalyzer, RepoContext } from "./analyzer.interface.js";

const PILLAR: PillarId = "P5";

export const docReadabilityAnalyzer: PillarAnalyzer = {
  pillar: PILLAR,
  name: PILLAR_NAMES[PILLAR],
  version: "0.1.0",

  async supports(): Promise<boolean> {
    return true;
  },

  async analyze(context: RepoContext) {
    const findings: Finding[] = [];
    let score = 0;

    // API contracts (OpenAPI/Swagger)
    const apiSpecs = context.files.filter(
      (f) => /openapi|swagger/i.test(f) && /\.(json|ya?ml)$/.test(f),
    );
    if (apiSpecs.length > 0) {
      score += 20;
    }

    // GraphQL schemas
    const graphqlSchemas = context.files.filter((f) => /\.graphql$|\.gql$/.test(f));
    if (graphqlSchemas.length > 0) {
      score += 15;
    }

    // tRPC or similar type-safe RPC
    const hasTrpc = context.files.some((f) => /trpc|\.router\.[jt]s/.test(f));
    if (hasTrpc) {
      score += 15;
    }

    // No API contracts at all? Only flag if it looks like a web project
    if (apiSpecs.length === 0 && graphqlSchemas.length === 0 && !hasTrpc) {
      const hasServerCode = context.files.some(
        (f) => /server|api|route|controller|handler/i.test(f) && /\.[jt]sx?$|\.py$|\.go$/.test(f),
      );
      if (hasServerCode) {
        findings.push({
          code: "ARI-DOC-001",
          severity: "medium",
          pillar: PILLAR,
          message: "Server code detected but no API contract (OpenAPI, GraphQL schema, tRPC)",
          remediation: {
            action: "create-file",
            description: "Add machine-readable API contract (OpenAPI spec, GraphQL schema, or tRPC router)",
            confidence: "medium",
          },
          evidence: {
            paper: "Tetrate, 2025",
            finding: "Unstructured doc parsing triples token costs",
            confidence: "medium",
          },
        });
      }
    }

    // Error taxonomy / structured error codes
    const hasErrorTaxonomy = context.files.some(
      (f) => /error.taxonomy|error.codes|errors?\.(json|ya?ml)/i.test(f),
    );
    if (hasErrorTaxonomy) {
      score += 15;
    }

    // Env var validation
    const envValidationPatterns = ["t3-env", "zod", "joi", "yup", "pydantic"];
    let hasEnvValidation = false;
    const pkg = await context.readJson<Record<string, unknown>>("package.json");
    if (pkg) {
      const deps = { ...(pkg["dependencies"] as Record<string, string> ?? {}), ...(pkg["devDependencies"] as Record<string, string> ?? {}) };
      hasEnvValidation = envValidationPatterns.some((p) => p in deps);
    }
    if (hasEnvValidation) {
      score += 10;
    }

    // ADR / decision records
    const hasADRs = context.files.some(
      (f) => /adr|decision|rfc/i.test(f) && /\.md$/.test(f),
    );
    if (hasADRs) {
      score += 10;
    }

    // Changelog format
    const hasChangelog = await context.fileExists("CHANGELOG.md");
    if (hasChangelog) {
      score += 5;
    }

    // Type exports / JSDoc
    const hasTypeExports = context.files.some(
      (f) => /\.d\.ts$|types\.[jt]s$/i.test(f),
    );
    if (hasTypeExports) {
      score += 10;
    }

    // README present and structured
    const readme = await context.readFile("README.md");
    if (readme) {
      const headingCount = (readme.match(/^#+\s/gm) ?? []).length;
      if (headingCount >= 5) {
        score += 10;
      } else if (headingCount >= 2) {
        score += 5;
      }
    }

    score = Math.min(100, Math.max(0, score));

    return {
      pillar: PILLAR,
      name: PILLAR_NAMES[PILLAR],
      score,
      weight: PILLAR_WEIGHTS[PILLAR],
      confidence: "medium",
      findings,
      summary: `API specs: ${apiSpecs.length}, GraphQL: ${graphqlSchemas.length > 0}, Error taxonomy: ${hasErrorTaxonomy}`,
    };
  },
};

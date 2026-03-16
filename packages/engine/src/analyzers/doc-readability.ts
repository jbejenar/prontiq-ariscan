import { type PillarId, PILLAR_NAMES, type Finding } from "@prontiq/ariscan-schema";
import type { PillarAnalyzer, RepoContext } from "./analyzer.interface.js";
import { buildPillarResult } from "./shared.js";

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
          message:
            "Server code detected but no API contract (OpenAPI, GraphQL schema, tRPC). Rationale: machine-readable contracts let agents understand API surface without parsing prose docs.",
          confidence: "medium",
          remediation: {
            action: "create-file",
            description:
              "Add machine-readable API contract (OpenAPI spec, GraphQL schema, or tRPC router)",
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
    const hasErrorTaxonomy = context.files.some((f) =>
      /error.taxonomy|error.codes|errors?\.(json|ya?ml)/i.test(f),
    );
    if (hasErrorTaxonomy) {
      score += 15;
    }

    // Env var validation
    const envValidationPatterns = ["t3-env", "zod", "joi", "yup", "pydantic"];
    let hasEnvValidation = false;
    // Check root package.json
    const pkg = await context.readJson<Record<string, unknown>>("package.json");
    if (pkg) {
      const deps = {
        ...((pkg["dependencies"] as Record<string, string>) ?? {}),
        ...((pkg["devDependencies"] as Record<string, string>) ?? {}),
      };
      hasEnvValidation = envValidationPatterns.some((p) => p in deps);
    }
    // Also check workspace package.json files (monorepo support)
    if (!hasEnvValidation) {
      const workspacePkgFiles = context.files.filter(
        (f) => f !== "package.json" && f.endsWith("/package.json") && !f.includes("node_modules"),
      );
      for (const wpf of workspacePkgFiles) {
        const wpkg = await context.readJson<Record<string, unknown>>(wpf);
        if (wpkg) {
          const deps = {
            ...((wpkg["dependencies"] as Record<string, string>) ?? {}),
            ...((wpkg["devDependencies"] as Record<string, string>) ?? {}),
          };
          if (envValidationPatterns.some((p) => p in deps)) {
            hasEnvValidation = true;
            break;
          }
        }
      }
    }
    // Also check Python projects for pydantic BaseSettings
    if (!hasEnvValidation) {
      const pyFiles = context.files.filter(
        (f) =>
          f.endsWith(".py") &&
          !f.includes("node_modules") &&
          !f.includes("__pycache__") &&
          !f.includes(".venv"),
      );
      const pySampled = pyFiles.slice(0, 10);
      for (const pyf of pySampled) {
        const content = await context.readFile(pyf);
        if (
          content &&
          (/from\s+pydantic_settings\s+import\s+BaseSettings/.test(content) ||
            /from\s+pydantic\s+import\s+BaseSettings/.test(content) ||
            /class\s+\w+\(BaseSettings\)/.test(content))
        ) {
          hasEnvValidation = true;
          break;
        }
      }
    }
    // Also check pyproject.toml for pydantic-settings dependency
    if (!hasEnvValidation) {
      const pyproject = await context.readFile("pyproject.toml");
      if (pyproject && /pydantic.settings|pydantic-settings/.test(pyproject)) {
        hasEnvValidation = true;
      }
    }
    if (hasEnvValidation) {
      score += 10;
    }

    // ADR / decision records
    const hasADRs = context.files.some((f) => /adr|decision|rfc/i.test(f) && /\.md$/.test(f));
    if (hasADRs) {
      score += 10;
    }

    // Changelog format
    const hasChangelog = await context.fileExists("CHANGELOG.md");
    if (hasChangelog) {
      score += 5;
    }

    // Type exports / JSDoc
    let hasTypeExports = context.files.some((f) => /\.d\.ts$|types\.[jt]s$/i.test(f));
    // Also check for schema/types/interface definition files (common in monorepos)
    if (!hasTypeExports) {
      hasTypeExports = context.files.some(
        (f) =>
          /\.schema\.[jt]s$|\.types\.[jt]s$|\.interface\.[jt]s$/i.test(f) ||
          /\/(types|schemas|interfaces)\//.test(f),
      );
    }
    // Check source files for Zod schema exports (sample up to 5)
    if (!hasTypeExports) {
      const candidateFiles = context.files
        .filter((f) => /\.[jt]sx?$/.test(f) && !f.includes("node_modules") && !f.includes("dist/"))
        .slice(0, 5);
      for (const cf of candidateFiles) {
        const content = await context.readFile(cf);
        if (
          content &&
          /z\.(object|enum|string|number|union|intersection|array)\s*\(/.test(content)
        ) {
          hasTypeExports = true;
          break;
        }
      }
    }
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

    // --- ARI-DOC-002: Machine-readable runbook detection ---
    const runbookFiles = context.files.filter((f) =>
      /runbook|playbook|procedures/i.test(f.split("/").pop() ?? f),
    );
    const machineReadableRunbooks = runbookFiles.filter((f) => /\.(json|ya?ml)$/.test(f));
    const proseOnlyRunbooks = runbookFiles.filter((f) => /\.md$/.test(f));

    if (machineReadableRunbooks.length > 0) {
      score += 5;
    } else if (proseOnlyRunbooks.length > 0) {
      findings.push({
        code: "ARI-DOC-002",
        severity: "low",
        pillar: PILLAR,
        message: `Found ${proseOnlyRunbooks.length} prose-only runbook(s) but no machine-readable (YAML/JSON) runbooks. Rationale: structured runbooks let agents execute operational procedures without NLP parsing.`,
        confidence: "medium",
        remediation: {
          action: "create-file",
          description: "Convert runbooks to YAML or JSON format for machine-readable operations",
          confidence: "medium",
        },
        evidence: {
          paper: "Tetrate, 2025",
          finding: "Unstructured doc parsing triples token costs",
          confidence: "medium",
        },
      });
    }

    // --- ARI-DOC-003: JSDoc coverage measurement ---
    const tsJsFiles = context.files.filter(
      (f) =>
        /\.[jt]sx?$/.test(f) &&
        !f.includes("node_modules") &&
        !f.includes("dist/") &&
        !f.includes("build/") &&
        !f.includes(".d.ts"),
    );

    if (tsJsFiles.length > 0) {
      const sampled = tsJsFiles.slice(0, 15);
      let filesWithJsdoc = 0;

      for (const file of sampled) {
        const content = await context.readFile(file);
        if (!content) continue;
        if (/\/\*\*[\s\S]*?\*\//.test(content)) {
          filesWithJsdoc++;
        }
      }

      const jsdocRatio = filesWithJsdoc / sampled.length;
      if (jsdocRatio >= 0.5) {
        score += 5;
      }
      if (jsdocRatio < 0.3) {
        findings.push({
          code: "ARI-DOC-003",
          severity: "low",
          pillar: PILLAR,
          message: `Only ${Math.round(jsdocRatio * 100)}% of sampled source files (${filesWithJsdoc}/${sampled.length}) contain JSDoc comments. Rationale: inline documentation helps agents understand intent without reading full function bodies.`,
          confidence: "low",
          remediation: {
            action: "refactor",
            description:
              "Add JSDoc comments to exported functions and classes for better AI comprehension",
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

    // --- ARI-DOC-004: Documentation-code drift detection ---
    if (readme) {
      // Extract file path references from README (e.g., src/foo.ts, ./bar/baz.js, packages/engine/)
      // Match both file paths (with extension) and directory paths (trailing slash or no extension)
      const pathRefs = readme.match(
        /(?:^|\s|`)((?:\.\/|src\/|packages\/|lib\/)[a-zA-Z0-9_\-/.]+)/gm,
      );
      if (pathRefs && pathRefs.length > 0) {
        const cleanedPaths = pathRefs.map((p) =>
          p.trim().replace(/^`|`$/g, "").replace(/^\.\//, ""),
        );
        let missingCount = 0;
        for (const ref of cleanedPaths) {
          const hasExtension = /\.[a-zA-Z]+$/.test(ref);
          let exists: boolean;
          if (hasExtension) {
            // File reference: exact or suffix match
            exists = context.files.some((f) => f === ref || f.endsWith(ref));
          } else {
            // Directory reference: check if any file starts with this path
            const dirPrefix = ref.endsWith("/") ? ref : ref + "/";
            exists = context.files.some((f) => f.startsWith(dirPrefix) || f.startsWith(ref + "/"));
          }
          if (!exists) {
            missingCount++;
          }
        }
        const driftRatio = missingCount / cleanedPaths.length;
        if (driftRatio > 0.3) {
          score -= 5;
          findings.push({
            code: "ARI-DOC-004",
            severity: "medium",
            pillar: PILLAR,
            message: `README references ${cleanedPaths.length} file paths but ${missingCount} (${Math.round(driftRatio * 100)}%) no longer exist — documentation may be stale. Rationale: stale path references cause agents to hallucinate about nonexistent files.`,
            confidence: "medium",
            remediation: {
              action: "modify-config",
              path: "README.md",
              description:
                "Update README to reflect current file structure and remove stale path references",
              confidence: "medium",
            },
          });
        }
      }
    }

    // --- ARI-DOC-005: Contributing guide detection ---
    const hasContributing =
      (await context.fileExists("CONTRIBUTING.md")) ||
      context.files.some((f) => /docs\/contributing/i.test(f));

    if (hasContributing) {
      score += 5;
      findings.push({
        code: "ARI-DOC-005",
        severity: "info",
        pillar: PILLAR,
        message:
          "Contributing guide found — agents can follow PR conventions, branch naming, and review expectations",
        confidence: "high",
        evidence: {
          paper: "OpenAPI Initiative, 2024",
          finding: "Machine-readable API specs reduce integration errors 40%",
          confidence: "high",
        },
      });
    } else {
      findings.push({
        code: "ARI-DOC-005",
        severity: "low",
        pillar: PILLAR,
        message:
          "No contributing guide found. Rationale: contributing guides help agents follow PR conventions, branch naming, and code review expectations.",
        confidence: "medium",
        remediation: {
          action: "create-file",
          path: "CONTRIBUTING.md",
          description:
            "Add a CONTRIBUTING.md with PR conventions, branch naming, commit message format, and review expectations",
          confidence: "high",
        },
      });
    }

    // --- ARI-DOC-006: Architecture documentation detection ---
    const hasArchitectureDocs =
      (await context.fileExists("ARCHITECTURE.md")) ||
      context.files.some((f) => /docs\/architecture/i.test(f) && /\.(md|ya?ml|json)$/.test(f));

    if (hasArchitectureDocs) {
      score += 5;
      findings.push({
        code: "ARI-DOC-006",
        severity: "info",
        pillar: PILLAR,
        message:
          "Architecture documentation found — agents can understand system boundaries and design constraints",
        confidence: "high",
        evidence: {
          paper: "OpenAPI Initiative, 2024",
          finding: "Machine-readable API specs reduce integration errors 40%",
          confidence: "high",
        },
      });
    } else {
      findings.push({
        code: "ARI-DOC-006",
        severity: "low",
        pillar: PILLAR,
        message:
          "No architecture documentation found. Rationale: architecture docs help agents understand system boundaries, module responsibilities, and design constraints.",
        confidence: "medium",
        remediation: {
          action: "create-file",
          path: "ARCHITECTURE.md",
          description:
            "Add architecture documentation describing system boundaries, module responsibilities, and key design decisions",
          confidence: "high",
        },
      });
    }

    return buildPillarResult(
      PILLAR,
      score,
      "medium",
      findings,
      `API specs: ${apiSpecs.length}, GraphQL: ${graphqlSchemas.length > 0}, Error taxonomy: ${hasErrorTaxonomy}, Runbooks: ${machineReadableRunbooks.length} machine-readable / ${proseOnlyRunbooks.length} prose`,
      [
        "Tetrate, 2025 — Unstructured doc parsing triples token costs",
        "OpenAPI Initiative, 2024 — Machine-readable API specs reduce integration errors 40%",
      ],
    );
  },
};

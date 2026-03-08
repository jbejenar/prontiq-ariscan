import { type PillarId, PILLAR_NAMES, PILLAR_WEIGHTS, type Finding } from "@prontiq/schema";
import type { PillarAnalyzer, RepoContext } from "./analyzer.interface.js";

const PILLAR: PillarId = "P4";

/** Extract process.env.XXX references from source content */
function extractEnvVarRefs(content: string): string[] {
  const matches: string[] = [];
  const regex = /process\.env\.([A-Z_][A-Z0-9_]*)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    if (match[1]) {
      matches.push(match[1]);
    }
  }
  return matches;
}

/** Extract variable names defined in .env.example content */
function extractEnvExampleVars(content: string): string[] {
  const vars: string[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const varName = trimmed.substring(0, eqIdx).trim();
      if (/^[A-Z_][A-Z0-9_]*$/.test(varName)) {
        vars.push(varName);
      }
    }
  }
  return vars;
}

export const devEnvironmentAnalyzer: PillarAnalyzer = {
  pillar: PILLAR,
  name: PILLAR_NAMES[PILLAR],
  version: "0.2.0",

  async supports(): Promise<boolean> {
    return true;
  },

  async analyze(context: RepoContext) {
    const findings: Finding[] = [];
    let score = 0;

    // --- Devcontainer ---
    const hasDevcontainer = await context.fileExists(".devcontainer/devcontainer.json");
    let devcontainerStatus: "pass" | "fail" | "partial" = "fail";

    if (hasDevcontainer) {
      score += 25;
      const dc = await context.readJson<Record<string, unknown>>(".devcontainer/devcontainer.json");
      if (dc) {
        if (dc["postCreateCommand"] || dc["onCreateCommand"]) score += 5;
        if (dc["features"]) score += 5;

        // ARI-ENV-005: Devcontainer validation
        const hasImageOrBuild = !!(dc["image"] || dc["build"]);
        const hasSettings = !!dc["settings"];
        const hasLifecycleCmd = !!(dc["postCreateCommand"] || dc["onCreateCommand"]);

        if (hasImageOrBuild && hasLifecycleCmd) {
          devcontainerStatus = "pass";
        } else if (!hasImageOrBuild) {
          devcontainerStatus = "partial";
          findings.push({
            code: "ARI-ENV-005",
            severity: "medium",
            pillar: PILLAR,
            message: "Devcontainer is missing 'image' or 'build' field — container may not be functional",
            remediation: {
              action: "modify-config",
              path: ".devcontainer/devcontainer.json",
              description: "Add an 'image' field (e.g. 'mcr.microsoft.com/devcontainers/typescript-node:1-20') or a 'build' field with Dockerfile reference",
              confidence: "high",
            },
          });
        } else {
          devcontainerStatus = "pass";
        }

        // Info finding for settings presence
        if (hasSettings) {
          score += 2;
        }
      }
    } else {
      findings.push({
        code: "ARI-ENV-001",
        severity: "medium",
        pillar: PILLAR,
        message: "No devcontainer configuration found",
        remediation: {
          action: "create-file",
          path: ".devcontainer/devcontainer.json",
          description: "Add devcontainer config for reproducible development environment",
          estimatedImpact: "+5 points composite",
          confidence: "high",
        },
        evidence: {
          paper: "VS Code Blog, 2022",
          finding: "94-96% drop-off rate with manual setup",
          confidence: "high",
        },
      });
    }

    // --- Docker Compose ---
    const hasCompose = await context.fileExists("docker-compose.yml") ||
      await context.fileExists("docker-compose.yaml") ||
      await context.fileExists("compose.yml");
    if (hasCompose) {
      score += 10;
    }

    // --- Bootstrap/setup scripts ---
    const setupScripts = [
      "scripts/setup.sh",
      "scripts/bootstrap.sh",
      "setup.sh",
      "Makefile",
      "justfile",
    ];
    let hasSetup = false;
    for (const s of setupScripts) {
      if (await context.fileExists(s)) {
        hasSetup = true;
        break;
      }
    }

    const pkg = await context.readJson<Record<string, unknown>>("package.json");
    const scripts = (pkg?.["scripts"] ?? {}) as Record<string, string>;
    if (scripts["setup"] || scripts["bootstrap"] || scripts["prepare"] || scripts["postinstall"]) {
      hasSetup = true;
    }

    if (hasSetup) {
      score += 15;
    } else {
      findings.push({
        code: "ARI-ENV-002",
        severity: "medium",
        pillar: PILLAR,
        message: "No bootstrap/setup script found",
        remediation: {
          action: "create-file",
          path: "scripts/setup.sh",
          description: "Create a single-command setup script for new contributors",
          confidence: "medium",
        },
      });
    }

    // --- Version management ---
    const versionFiles = [".nvmrc", ".node-version", ".tool-versions", ".python-version", "rust-toolchain.toml"];
    let hasVersionPinning = false;
    for (const vf of versionFiles) {
      if (await context.fileExists(vf)) {
        hasVersionPinning = true;
        break;
      }
    }
    if (pkg?.["engines"]) {
      hasVersionPinning = true;
    }

    if (hasVersionPinning) {
      score += 10;
    } else {
      findings.push({
        code: "ARI-ENV-003",
        severity: "low",
        pillar: PILLAR,
        message: "No version pinning found (.nvmrc, .tool-versions, engines field)",
        remediation: {
          action: "create-file",
          path: ".nvmrc",
          description: "Pin the runtime version for reproducible builds",
          confidence: "high",
        },
      });
    }

    // --- Env var documentation ---
    const hasEnvExample = await context.fileExists(".env.example") || await context.fileExists(".env.template");
    if (hasEnvExample) {
      score += 10;
    }

    // --- README setup section ---
    const readme = await context.readFile("README.md");
    if (readme) {
      const hasSetupSection = /##?\s*(setup|getting started|installation|quick start)/i.test(readme);
      if (hasSetupSection) {
        score += 10;
      }
    }

    // --- Contributing guide ---
    if (await context.fileExists("CONTRIBUTING.md")) {
      score += 10;
    }

    // --- Doctor/health-check command ---
    let hasDoctorCmd = false;
    const allScriptNames = Object.keys(scripts);
    for (const scriptName of allScriptNames) {
      if (/doctor|health|check:env|verify:env|diagnose/i.test(scriptName)) {
        hasDoctorCmd = true;
        break;
      }
    }
    if (!hasDoctorCmd) {
      for (const scriptValue of Object.values(scripts)) {
        if (/doctor|health-check|healthcheck/i.test(scriptValue)) {
          hasDoctorCmd = true;
          break;
        }
      }
    }
    if (hasDoctorCmd) {
      score += 5;
    } else {
      findings.push({
        code: "ARI-ENV-004",
        severity: "low",
        pillar: PILLAR,
        message: "No doctor/health-check command found in package.json scripts",
        remediation: {
          action: "add-script",
          description: "Add a 'doctor' or 'health-check' script that validates the dev environment (node version, required tools, etc.)",
          confidence: "medium",
        },
      });
    }

    // --- Seed/fixture data ---
    const seedFixtureDirs = ["seeds/", "seed/", "fixtures/", "fixture/", "testdata/", "test-data/", "test_data/"];
    let hasSeedData = false;
    for (const dir of seedFixtureDirs) {
      if (context.files.some((f) => f.startsWith(dir) || f.includes(`/${dir}`))) {
        hasSeedData = true;
        break;
      }
    }
    if (!hasSeedData) {
      for (const scriptName of allScriptNames) {
        if (/seed|fixture/i.test(scriptName)) {
          hasSeedData = true;
          break;
        }
      }
    }
    if (hasSeedData) {
      score += 5;
    }

    // --- NEW: ARI-ENV-005 devcontainer validation info status ---
    findings.push({
      code: "ARI-ENV-005",
      severity: "info",
      pillar: PILLAR,
      message: `Devcontainer: ${devcontainerStatus}`,
    });

    // --- NEW: ARI-ENV-006 — First-run blockers ---
    const blockers: string[] = [];

    // Check for missing .env.example when code references process.env
    const sourceFilesForEnv = context.files.filter(
      (f) =>
        /\.[jt]sx?$/.test(f) &&
        !f.includes("node_modules") &&
        !f.includes(".test.") &&
        !f.includes(".spec."),
    );
    const sampledSourceFiles = sourceFilesForEnv.slice(0, 30);
    let codeReferencesEnv = false;
    for (const sf of sampledSourceFiles) {
      const content = await context.readFile(sf);
      if (content && /process\.env\./.test(content)) {
        codeReferencesEnv = true;
        break;
      }
    }
    if (codeReferencesEnv && !hasEnvExample) {
      blockers.push("Missing .env.example while code references process.env");
    }

    // No install command obvious
    const hasPackageJson = await context.fileExists("package.json");
    const hasMakefile = await context.fileExists("Makefile");
    const hasRequirementsTxt = await context.fileExists("requirements.txt");
    const hasGoMod = await context.fileExists("go.mod");
    if (!hasPackageJson && !hasMakefile && !hasRequirementsTxt && !hasGoMod) {
      blockers.push("No install command obvious (no package.json, Makefile, requirements.txt, or go.mod)");
    }

    // TypeScript project without tsconfig
    const hasTsFiles = context.files.some((f) => /\.tsx?$/.test(f) && !f.includes("node_modules"));
    const hasTsConfig = await context.fileExists("tsconfig.json");
    if (hasTsFiles && !hasTsConfig) {
      blockers.push("TypeScript files found but no tsconfig.json");
    }

    if (blockers.length > 0) {
      score -= Math.min(10, blockers.length * 3);
      findings.push({
        code: "ARI-ENV-006",
        severity: "high",
        pillar: PILLAR,
        message: `Likely first-run blockers: ${blockers.join("; ")}`,
        remediation: {
          action: "create-file",
          description: "Address the listed blockers to reduce onboarding friction for new developers and AI agents",
          confidence: "high",
        },
        evidence: {
          paper: "VS Code Blog, 2022",
          finding: "94-96% drop-off rate with manual setup",
          confidence: "high",
        },
      });
    } else {
      findings.push({
        code: "ARI-ENV-006",
        severity: "info",
        pillar: PILLAR,
        message: "No obvious first-run blockers detected",
      });
    }

    // --- NEW: ARI-ENV-007 — Environment variable completeness ---
    if (hasEnvExample) {
      const envExampleContent = await context.readFile(".env.example") ?? await context.readFile(".env.template") ?? "";
      const documentedVars = extractEnvExampleVars(envExampleContent);

      // Sample source files for process.env references
      const allReferencedVars = new Set<string>();
      for (const sf of sampledSourceFiles) {
        const content = await context.readFile(sf);
        if (content) {
          for (const varName of extractEnvVarRefs(content)) {
            allReferencedVars.add(varName);
          }
        }
      }

      // Filter out common Node built-ins
      const builtins = new Set(["NODE_ENV", "HOME", "PATH", "PWD", "USER", "SHELL", "TERM"]);
      const missingVars = [...allReferencedVars].filter(
        (v) => !documentedVars.includes(v) && !builtins.has(v),
      );

      if (missingVars.length > 0) {
        findings.push({
          code: "ARI-ENV-007",
          severity: "medium",
          pillar: PILLAR,
          message: `Environment variable completeness: ${missingVars.length} var(s) referenced in code but missing from .env.example: ${missingVars.slice(0, 10).join(", ")}${missingVars.length > 10 ? "..." : ""}`,
          remediation: {
            action: "modify-config",
            path: ".env.example",
            description: `Add missing variables to .env.example: ${missingVars.join(", ")}`,
            confidence: "medium",
          },
        });
      } else {
        findings.push({
          code: "ARI-ENV-007",
          severity: "info",
          pillar: PILLAR,
          message: `Environment variable completeness: all referenced vars documented in .env.example (${documentedVars.length} vars)`,
        });
      }
    } else if (codeReferencesEnv) {
      findings.push({
        code: "ARI-ENV-007",
        severity: "medium",
        pillar: PILLAR,
        message: "No .env.example found but code references process.env variables",
        remediation: {
          action: "create-file",
          path: ".env.example",
          description: "Create .env.example to document required environment variables",
          confidence: "high",
        },
      });
    }

    // --- NEW: Per-criterion status labels (info findings) ---
    findings.push({
      code: "ARI-ENV-008",
      severity: "info",
      pillar: PILLAR,
      message: `Setup scripts: ${hasSetup ? "pass" : "fail"}`,
    });

    findings.push({
      code: "ARI-ENV-009",
      severity: "info",
      pillar: PILLAR,
      message: `Version pinning: ${hasVersionPinning ? "pass" : "fail"}`,
    });

    findings.push({
      code: "ARI-ENV-010",
      severity: "info",
      pillar: PILLAR,
      message: `Docker Compose: ${hasCompose ? "pass" : "fail"}`,
    });

    findings.push({
      code: "ARI-ENV-011",
      severity: "info",
      pillar: PILLAR,
      message: `Env example file: ${hasEnvExample ? "pass" : "fail"}`,
    });

    findings.push({
      code: "ARI-ENV-012",
      severity: "info",
      pillar: PILLAR,
      message: `Doctor/health-check: ${hasDoctorCmd ? "pass" : "fail"}`,
    });

    score = Math.min(100, Math.max(0, score));

    return {
      pillar: PILLAR,
      name: PILLAR_NAMES[PILLAR],
      score,
      weight: PILLAR_WEIGHTS[PILLAR],
      confidence: "medium",
      findings,
      summary: `Dev environment: devcontainer=${devcontainerStatus}, setup=${hasSetup}, versions=${hasVersionPinning}`,
    };
  },
};

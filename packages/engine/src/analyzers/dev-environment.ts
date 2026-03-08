import { type PillarId, PILLAR_NAMES, PILLAR_WEIGHTS, type Finding } from "@prontiq/schema";
import type { PillarAnalyzer, RepoContext } from "./analyzer.interface.js";

const PILLAR: PillarId = "P4";

export const devEnvironmentAnalyzer: PillarAnalyzer = {
  pillar: PILLAR,
  name: PILLAR_NAMES[PILLAR],
  version: "0.1.0",

  async supports(): Promise<boolean> {
    return true;
  },

  async analyze(context: RepoContext) {
    const findings: Finding[] = [];
    let score = 0;

    // Devcontainer
    const hasDevcontainer = await context.fileExists(".devcontainer/devcontainer.json");
    if (hasDevcontainer) {
      score += 25;
      const dc = await context.readJson<Record<string, unknown>>(".devcontainer/devcontainer.json");
      if (dc) {
        if (dc["postCreateCommand"] || dc["onCreateCommand"]) score += 5;
        if (dc["features"]) score += 5;
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

    // Docker Compose
    const hasCompose = await context.fileExists("docker-compose.yml") ||
      await context.fileExists("docker-compose.yaml") ||
      await context.fileExists("compose.yml");
    if (hasCompose) {
      score += 10;
    }

    // Bootstrap/setup scripts
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

    // Check package.json for setup scripts
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

    // Version management
    const versionFiles = [".nvmrc", ".node-version", ".tool-versions", ".python-version", "rust-toolchain.toml"];
    let hasVersionPinning = false;
    for (const vf of versionFiles) {
      if (await context.fileExists(vf)) {
        hasVersionPinning = true;
        break;
      }
    }
    // Also check engines field in package.json
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

    // Env var documentation
    const hasEnvExample = await context.fileExists(".env.example") || await context.fileExists(".env.template");
    if (hasEnvExample) {
      score += 10;
    }

    // README setup section
    const readme = await context.readFile("README.md");
    if (readme) {
      const hasSetupSection = /##?\s*(setup|getting started|installation|quick start)/i.test(readme);
      if (hasSetupSection) {
        score += 10;
      }
    }

    // Contributing guide
    if (await context.fileExists("CONTRIBUTING.md")) {
      score += 10;
    }

    // Doctor/health-check command detection
    let hasDoctorCmd = false;
    const allScriptNames = Object.keys(scripts);
    for (const scriptName of allScriptNames) {
      if (/doctor|health|check:env|verify:env|diagnose/i.test(scriptName)) {
        hasDoctorCmd = true;
        break;
      }
    }
    // Also check script values for doctor commands
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

    // Seed/fixture data detection
    const seedFixtureDirs = ["seeds/", "seed/", "fixtures/", "fixture/", "testdata/", "test-data/", "test_data/"];
    let hasSeedData = false;
    for (const dir of seedFixtureDirs) {
      if (context.files.some((f) => f.startsWith(dir) || f.includes(`/${dir}`))) {
        hasSeedData = true;
        break;
      }
    }
    // Also check for seed scripts in package.json
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

    score = Math.min(100, Math.max(0, score));

    return {
      pillar: PILLAR,
      name: PILLAR_NAMES[PILLAR],
      score,
      weight: PILLAR_WEIGHTS[PILLAR],
      confidence: "medium",
      findings,
      summary: `Dev environment: devcontainer=${hasDevcontainer}, setup=${hasSetup}, versions=${hasVersionPinning}`,
    };
  },
};

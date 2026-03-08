import { type PillarId, PILLAR_NAMES, PILLAR_WEIGHTS, type Finding } from "@prontiq/schema";
import type { PillarAnalyzer, RepoContext } from "./analyzer.interface.js";

const PILLAR: PillarId = "P8";

export const securityGovernanceAnalyzer: PillarAnalyzer = {
  pillar: PILLAR,
  name: PILLAR_NAMES[PILLAR],
  version: "0.1.0",

  async supports(): Promise<boolean> {
    return true;
  },

  async analyze(context: RepoContext) {
    const findings: Finding[] = [];
    let score = 0;

    // CODEOWNERS
    const hasCodeowners = await context.fileExists("CODEOWNERS") ||
      await context.fileExists(".github/CODEOWNERS") ||
      await context.fileExists("docs/CODEOWNERS");
    if (hasCodeowners) {
      score += 15;
    } else {
      findings.push({
        code: "ARI-SEC-001",
        severity: "medium",
        pillar: PILLAR,
        message: "No CODEOWNERS file found",
        remediation: {
          action: "create-file",
          path: ".github/CODEOWNERS",
          description: "Add CODEOWNERS to define code review ownership for critical paths",
          confidence: "high",
        },
      });
    }

    // Security policy
    const hasSecurityPolicy = await context.fileExists("SECURITY.md") ||
      await context.fileExists(".github/SECURITY.md");
    if (hasSecurityPolicy) {
      score += 10;
    } else {
      findings.push({
        code: "ARI-SEC-002",
        severity: "low",
        pillar: PILLAR,
        message: "No SECURITY.md found",
        remediation: {
          action: "create-file",
          path: "SECURITY.md",
          description: "Add security policy with vulnerability reporting instructions",
          confidence: "high",
        },
      });
    }

    // Secrets scanning config
    const hasSecretsScanning = await context.fileExists(".gitleaks.toml") ||
      await context.fileExists(".pre-commit-config.yaml") ||
      await context.fileExists(".sops.yaml");

    // Check GitHub Actions for secrets scanning
    const workflows = context.files.filter((f) => f.startsWith(".github/workflows/"));
    let hasSecretsScanningCI = false;
    for (const wf of workflows) {
      const content = await context.readFile(wf);
      if (content && /gitleaks|trufflehog|detect-secrets|secret.scanning/i.test(content)) {
        hasSecretsScanningCI = true;
        break;
      }
    }

    if (hasSecretsScanning || hasSecretsScanningCI) {
      score += 15;
    } else {
      findings.push({
        code: "ARI-SEC-003",
        severity: "high",
        pillar: PILLAR,
        message: "No secrets scanning configuration found",
        remediation: {
          action: "configure-tool",
          description: "Add gitleaks or truffleHog for secrets scanning in CI",
          confidence: "high",
        },
        evidence: {
          paper: "Veracode, 2025",
          finding: "AI hardcodes credentials 2x human rate",
          confidence: "high",
        },
      });
    }

    // Dependency audit (Dependabot, Renovate, Snyk)
    const hasDependabot = await context.fileExists(".github/dependabot.yml");
    const hasRenovate = await context.fileExists("renovate.json") ||
      await context.fileExists(".github/renovate.json");
    if (hasDependabot || hasRenovate) {
      score += 15;
    } else {
      findings.push({
        code: "ARI-SEC-004",
        severity: "medium",
        pillar: PILLAR,
        message: "No dependency update automation (Dependabot, Renovate)",
        remediation: {
          action: "create-file",
          path: ".github/dependabot.yml",
          description: "Add Dependabot or Renovate for automated dependency updates",
          confidence: "high",
        },
      });
    }

    // Branch protection (check for GitHub config)
    const hasBranchProtection = context.files.some(
      (f) => f.includes(".github/") && /branch.protection|ruleset/i.test(f),
    );
    // Can also infer from PR requirements in workflows
    let hasPRRequirements = false;
    for (const wf of workflows) {
      const content = await context.readFile(wf);
      if (content && /pull_request|required.*check|status.*check/i.test(content)) {
        hasPRRequirements = true;
        break;
      }
    }
    if (hasBranchProtection || hasPRRequirements) {
      score += 15;
    }

    // SAST configuration
    let hasSAST = false;
    for (const wf of workflows) {
      const content = await context.readFile(wf);
      if (content && /codeql|semgrep|snyk|sonar|eslint.*security/i.test(content)) {
        hasSAST = true;
        break;
      }
    }
    if (hasSAST) {
      score += 15;
    }

    // License
    const hasLicense = await context.fileExists("LICENSE") ||
      await context.fileExists("LICENSE.md") ||
      await context.fileExists("LICENSE.txt");
    if (hasLicense) {
      score += 5;
    }

    // PR template
    const hasPRTemplate = await context.fileExists(".github/pull_request_template.md") ||
      await context.fileExists(".github/PULL_REQUEST_TEMPLATE.md");
    if (hasPRTemplate) {
      score += 5;
    }

    // .gitignore with sensitive patterns
    const gitignore = await context.readFile(".gitignore");
    if (gitignore && /\.env|credentials|secret/i.test(gitignore)) {
      score += 5;
    }

    // AI-specific review checklist in PR templates
    const prTemplateContent = await context.readFile(".github/PULL_REQUEST_TEMPLATE.md") ??
      await context.readFile(".github/pull_request_template.md");
    if (prTemplateContent && /\b(ai|agent|llm|copilot|gpt|claude|machine.?generated|ai.?generated)\b/i.test(prTemplateContent)) {
      score += 5;
    } else {
      findings.push({
        code: "ARI-SEC-005",
        severity: "low",
        pillar: PILLAR,
        message: "PR template does not include AI-specific review checklist items",
        remediation: {
          action: "modify-config",
          path: ".github/PULL_REQUEST_TEMPLATE.md",
          description: "Add an AI/agent review section to your PR template (e.g., 'Was this code AI-generated?', 'Have AI-generated changes been reviewed for security?')",
          confidence: "medium",
        },
      });
    }

    // .agentignore or agent scope control detection
    const hasAgentIgnore = await context.fileExists(".agentignore");
    const hasClaudeIgnore = await context.fileExists(".claudeignore");
    const hasCopilotIgnore = await context.fileExists(".copilotignore");
    const hasGitHubCopilotConfig = await context.fileExists(".github/copilot-instructions.md");
    const hasClaudeMd = await context.fileExists("CLAUDE.md") || await context.fileExists(".claude/settings.json");

    if (hasAgentIgnore || hasClaudeIgnore || hasCopilotIgnore || hasGitHubCopilotConfig || hasClaudeMd) {
      score += 5;
    } else {
      findings.push({
        code: "ARI-SEC-006",
        severity: "low",
        pillar: PILLAR,
        message: "No agent scope control found (.agentignore, .claudeignore, .copilotignore, or CLAUDE.md)",
        remediation: {
          action: "create-file",
          path: ".agentignore",
          description: "Add an .agentignore or similar file to restrict which files AI agents can access or modify",
          confidence: "medium",
        },
      });
    }

    score = Math.min(100, Math.max(0, score));

    return {
      pillar: PILLAR,
      name: PILLAR_NAMES[PILLAR],
      score,
      weight: PILLAR_WEIGHTS[PILLAR],
      confidence: "medium",
      findings,
      summary: `CODEOWNERS: ${hasCodeowners}, Secrets scanning: ${hasSecretsScanning || hasSecretsScanningCI}, Dep audit: ${hasDependabot || hasRenovate}, SAST: ${hasSAST}`,
    };
  },
};

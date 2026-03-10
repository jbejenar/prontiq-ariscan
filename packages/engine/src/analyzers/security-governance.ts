import { type PillarId, PILLAR_NAMES, PILLAR_WEIGHTS, type Finding } from "@prontiq/schema";
import type { PillarAnalyzer, RepoContext } from "./analyzer.interface.js";

const PILLAR: PillarId = "P8";

/**
 * Language-specific vulnerability rates from research.
 * Used to provide targeted context in security findings (AC#5).
 */
const LANGUAGE_VULNERABILITY_CONTEXT: Record<
  string,
  { rate: string; context: string; source: string }
> = {
  java: {
    rate: "72%",
    context: "Java AI-generated code has the highest vulnerability rate at 72%",
    source: "Veracode, 2025",
  },
  javascript: {
    rate: "56%",
    context:
      "JavaScript AI-generated code shows ~56% vulnerability rate with XSS and prototype pollution risks",
    source: "Veracode, 2025; Apiiro, 2025",
  },
  typescript: {
    rate: "48%",
    context:
      "TypeScript AI-generated code shows ~48% vulnerability rate, mitigated by strict type checking",
    source: "Veracode, 2025; TyFlow, 2025",
  },
  python: {
    rate: "38%",
    context:
      "Python AI-generated code has ~38% vulnerability rate with injection and deserialization risks",
    source: "Veracode, 2025",
  },
  go: {
    rate: "44%",
    context:
      "Go AI-generated code shows ~44% vulnerability rate with concurrency and error handling issues",
    source: "Cotroneo et al., 2025",
  },
  rust: {
    rate: "25%",
    context:
      "Rust AI-generated code has the lowest vulnerability rate (~25%) but unsafe blocks bypass safety",
    source: "Cotroneo et al., 2025",
  },
  "c#": {
    rate: "52%",
    context:
      "C# AI-generated code shows ~52% vulnerability rate with SQL injection and auth bypass risks",
    source: "Veracode, 2025",
  },
  ruby: {
    rate: "46%",
    context:
      "Ruby AI-generated code shows ~46% vulnerability rate with command injection and mass assignment risks",
    source: "Cotroneo et al., 2025",
  },
};

/** Map file extensions to language keys for vulnerability lookup. */
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  ".java": "java",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".mts": "typescript",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".cs": "c#",
  ".rb": "ruby",
};

/** Severity ordering for risk-priority sort (AC#1). */
const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

/** Detect primary languages from file extensions. Returns sorted by file count descending. */
function detectLanguages(files: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const f of files) {
    const dotIdx = f.lastIndexOf(".");
    if (dotIdx === -1) continue;
    const ext = f.slice(dotIdx).toLowerCase();
    const lang = EXTENSION_TO_LANGUAGE[ext];
    if (lang) {
      counts.set(lang, (counts.get(lang) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([lang]) => lang);
}

export const securityGovernanceAnalyzer: PillarAnalyzer = {
  pillar: PILLAR,
  name: PILLAR_NAMES[PILLAR],
  version: "0.2.0",

  async supports(): Promise<boolean> {
    return true;
  },

  async analyze(context: RepoContext) {
    const findings: Finding[] = [];
    let score = 0;

    // --- AI-specific score tracking (AC#3) ---
    let aiSpecificScore = 0;
    let aiSpecificMax = 0;

    // CODEOWNERS
    const hasCodeowners =
      (await context.fileExists("CODEOWNERS")) ||
      (await context.fileExists(".github/CODEOWNERS")) ||
      (await context.fileExists("docs/CODEOWNERS"));
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
        evidence: {
          paper: "Pearce et al., 2021; CodeRabbit, 2025",
          finding:
            "AI PRs have 1.7x more issues than human PRs — mandatory review ownership reduces unreviewed AI changes reaching production",
          confidence: "high",
        },
      });
    }

    // Security policy
    const hasSecurityPolicy =
      (await context.fileExists("SECURITY.md")) ||
      (await context.fileExists(".github/SECURITY.md"));
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
        evidence: {
          paper: "OWASP, 2024",
          finding:
            "A security policy establishes a vulnerability disclosure channel — without it, security issues found in AI-generated code have no clear reporting path",
          confidence: "medium",
        },
      });
    }

    // Secrets scanning config
    const hasSecretsScanning =
      (await context.fileExists(".gitleaks.toml")) ||
      (await context.fileExists(".pre-commit-config.yaml")) ||
      (await context.fileExists(".sops.yaml"));

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
          finding:
            "AI assistants hardcode credentials at 2x the human rate — secrets scanning is critical to catch AI-introduced credential leaks before they reach production",
          confidence: "high",
        },
      });
    }

    // Dependency audit (Dependabot, Renovate, Snyk)
    const hasDependabot = await context.fileExists(".github/dependabot.yml");
    const hasRenovate =
      (await context.fileExists("renovate.json")) ||
      (await context.fileExists(".github/renovate.json"));
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
        evidence: {
          paper: "Apiiro, 2025",
          finding:
            "AI agents introduce 10,000+ new security findings/month — automated dependency auditing catches vulnerable transitive dependencies before agents pull them in",
          confidence: "high",
        },
      });
    }

    // Branch protection (check for GitHub config)
    const hasBranchProtection = context.files.some(
      (f) => f.includes(".github/") && /branch.protection|ruleset/i.test(f),
    );
    // Tightened: only count pull_request trigger if the workflow also
    // includes required/check/review patterns alongside it
    let hasPRRequirements = false;
    for (const wf of workflows) {
      const content = await context.readFile(wf);
      if (!content) continue;
      const hasPullRequestTrigger = /pull_request/i.test(content);
      const hasEnforcementPattern = /required|status.*check|review|branch.*protect/i.test(content);
      if (hasPullRequestTrigger && hasEnforcementPattern) {
        hasPRRequirements = true;
        break;
      }
    }
    if (hasBranchProtection || hasPRRequirements) {
      score += 15;
    }

    // SAST configuration — AI-specific (AC#3)
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
      aiSpecificScore += 15;
    }
    aiSpecificMax += 15;

    // License
    const hasLicense =
      (await context.fileExists("LICENSE")) ||
      (await context.fileExists("LICENSE.md")) ||
      (await context.fileExists("LICENSE.txt"));
    if (hasLicense) {
      score += 5;
    }

    // PR template
    const hasPRTemplate =
      (await context.fileExists(".github/pull_request_template.md")) ||
      (await context.fileExists(".github/PULL_REQUEST_TEMPLATE.md"));
    if (hasPRTemplate) {
      score += 5;
    }

    // .gitignore with sensitive patterns
    const gitignore = await context.readFile(".gitignore");
    const hasGitignoreSensitive = !!(gitignore && /\.env|credentials|secret/i.test(gitignore));
    if (hasGitignoreSensitive) {
      score += 5;
    }

    // --- ARI-SEC-007: License compliance tooling ---
    let hasLicenseCompliance = false;
    for (const wf of workflows) {
      const content = await context.readFile(wf);
      if (content && /license-checker|fossa|license-finder|licensee/i.test(content)) {
        hasLicenseCompliance = true;
        break;
      }
    }
    // Also check package.json scripts for license checking
    if (!hasLicenseCompliance) {
      const pkgCheck = await context.readJson<Record<string, unknown>>("package.json");
      if (pkgCheck) {
        const scripts = (pkgCheck["scripts"] ?? {}) as Record<string, string>;
        hasLicenseCompliance = Object.values(scripts).some((cmd) =>
          /license-checker|fossa|license-finder|licensee/i.test(cmd),
        );
      }
    }
    if (hasLicenseCompliance) {
      score += 5;
    } else {
      findings.push({
        code: "ARI-SEC-007",
        severity: "low",
        pillar: PILLAR,
        message: "No license compliance tooling found in CI workflows",
        remediation: {
          action: "configure-tool",
          description:
            "Add license-checker, FOSSA, license-finder, or licensee to CI for automated license compliance checks",
          confidence: "medium",
        },
        evidence: {
          paper: "Cotroneo et al., 2025",
          finding:
            "AI agents copy code from training data without license awareness — automated license checking prevents accidental license violations in AI-generated code",
          confidence: "medium",
        },
      });
    }

    // AI-specific review checklist in PR templates — AI-specific (AC#3)
    const prTemplateContent =
      (await context.readFile(".github/PULL_REQUEST_TEMPLATE.md")) ??
      (await context.readFile(".github/pull_request_template.md"));
    const hasAIReviewChecklist =
      !!prTemplateContent &&
      /\b(ai|agent|llm|copilot|gpt|claude|machine.?generated|ai.?generated)\b/i.test(
        prTemplateContent,
      );
    if (hasAIReviewChecklist) {
      score += 5;
      aiSpecificScore += 5;
    } else {
      findings.push({
        code: "ARI-SEC-005",
        severity: "low",
        pillar: PILLAR,
        message: "PR template does not include AI-specific review checklist items",
        remediation: {
          action: "modify-config",
          path: ".github/PULL_REQUEST_TEMPLATE.md",
          description:
            "Add an AI/agent review section to your PR template (e.g., 'Was this code AI-generated?', 'Have AI-generated changes been reviewed for security?')",
          confidence: "medium",
        },
        evidence: {
          paper: "CodeRabbit, 2025; IEEE-ISTAS, 2025",
          finding:
            "AI PRs have 1.7x more issues and vulnerabilities increase 37.6% over iterations — explicit AI review checklists catch security anti-patterns that standard reviews miss",
          confidence: "high",
        },
      });
    }
    aiSpecificMax += 5;

    // .agentignore or agent scope control detection — AI-specific (AC#3)
    const hasAgentIgnore = await context.fileExists(".agentignore");
    const hasClaudeIgnore = await context.fileExists(".claudeignore");
    const hasCopilotIgnore = await context.fileExists(".copilotignore");
    const hasGitHubCopilotConfig = await context.fileExists(".github/copilot-instructions.md");
    const hasClaudeMd =
      (await context.fileExists("CLAUDE.md")) ||
      (await context.fileExists(".claude/settings.json"));

    const hasAgentScope =
      hasAgentIgnore ||
      hasClaudeIgnore ||
      hasCopilotIgnore ||
      hasGitHubCopilotConfig ||
      hasClaudeMd;
    if (hasAgentScope) {
      score += 5;
      aiSpecificScore += 5;
    } else {
      findings.push({
        code: "ARI-SEC-006",
        severity: "low",
        pillar: PILLAR,
        message:
          "No agent scope control found (.agentignore, .claudeignore, .copilotignore, or CLAUDE.md)",
        remediation: {
          action: "create-file",
          path: ".agentignore",
          description:
            "Add an .agentignore or similar file to restrict which files AI agents can access or modify",
          confidence: "medium",
        },
        evidence: {
          paper: "Apiiro, 2025",
          finding:
            "Privilege escalation in AI-generated code is up 322% — agent scope controls limit the blast radius by preventing agents from modifying sensitive paths",
          confidence: "high",
        },
      });
    }
    aiSpecificMax += 5;

    // --- AC#5: Language-specific vulnerability context (ARI-SEC-008) ---
    const detectedLanguages = detectLanguages(context.files);
    const languageContextEntries: string[] = [];
    for (const lang of detectedLanguages) {
      const ctx = LANGUAGE_VULNERABILITY_CONTEXT[lang];
      if (ctx) {
        languageContextEntries.push(`${lang}: ${ctx.rate} vulnerability rate (${ctx.source})`);
      }
    }
    if (languageContextEntries.length > 0) {
      const primaryLang = detectedLanguages[0];
      const primaryCtx = primaryLang ? LANGUAGE_VULNERABILITY_CONTEXT[primaryLang] : undefined;
      findings.push({
        code: "ARI-SEC-008",
        severity: "info",
        pillar: PILLAR,
        message: `Language-specific AI vulnerability context: ${languageContextEntries.join("; ")}`,
        remediation: {
          action: "configure-tool",
          description: primaryCtx
            ? `${primaryCtx.context}. Prioritize SAST rules and code review practices for ${primaryLang}-specific vulnerability patterns.`
            : "Configure language-appropriate SAST rules for your detected languages.",
          confidence: "medium",
        },
        evidence: {
          paper: primaryCtx?.source ?? "Veracode, 2025; Cotroneo et al., 2025",
          finding: primaryCtx
            ? primaryCtx.context
            : "AI-generated code vulnerability rates vary significantly by language",
          confidence: "medium",
        },
      });
    }

    score = Math.min(100, Math.max(0, score));

    // --- Sort findings by severity for risk-priority ordering (AC#1) ---
    findings.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4));

    // Build configuration status labels
    const statusLabel = (configured: boolean, partial?: boolean): string => {
      if (configured) return "configured";
      if (partial) return "partial";
      return "missing";
    };

    const codeownersStatus = statusLabel(hasCodeowners);
    const secretsScanningStatus = statusLabel(
      hasSecretsScanning || hasSecretsScanningCI,
      hasSecretsScanning !== hasSecretsScanningCI,
    );
    const depAuditStatus = statusLabel(hasDependabot || hasRenovate);
    const sastStatus = statusLabel(hasSAST);
    const branchProtectionStatus = statusLabel(
      hasBranchProtection || hasPRRequirements,
      hasBranchProtection !== hasPRRequirements,
    );
    const licenseComplianceStatus = statusLabel(hasLicenseCompliance);
    const gitignoreStatus = statusLabel(hasGitignoreSensitive);

    // AI-specific security sub-score (AC#3)
    const aiScorePercent =
      aiSpecificMax > 0 ? Math.round((aiSpecificScore / aiSpecificMax) * 100) : 0;

    return {
      pillar: PILLAR,
      name: PILLAR_NAMES[PILLAR],
      score,
      weight: PILLAR_WEIGHTS[PILLAR],
      confidence: "medium",
      findings,
      summary: `CODEOWNERS: ${codeownersStatus}, Secrets scanning: ${secretsScanningStatus}, Dep audit: ${depAuditStatus}, SAST: ${sastStatus}, Branch protection: ${branchProtectionStatus}, License compliance: ${licenseComplianceStatus}, .gitignore: ${gitignoreStatus} | AI-specific security: ${aiScorePercent}% (${aiSpecificScore}/${aiSpecificMax})`,
    };
  },
};

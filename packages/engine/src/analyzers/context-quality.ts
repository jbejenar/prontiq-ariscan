import { type PillarId, PILLAR_NAMES, PILLAR_WEIGHTS, type Finding } from "@prontiq/schema";
import type { PillarAnalyzer, RepoContext } from "./analyzer.interface.js";

const PILLAR: PillarId = "P1";

const CONTEXT_FILES = [
  "AGENTS.md",
  "CLAUDE.md",
  ".cursorrules",
  ".cursor/rules",
  ".github/copilot-instructions.md",
  ".aider.conf.yml",
  ".aiderignore",
  ".agentignore",
] as const;

export const contextQualityAnalyzer: PillarAnalyzer = {
  pillar: PILLAR,
  name: PILLAR_NAMES[PILLAR],
  version: "0.1.0",

  async supports(): Promise<boolean> {
    return true;
  },

  async analyze(context: RepoContext) {
    const findings: Finding[] = [];
    let score = 20; // Baseline: no context files = 20%

    const foundContextFiles: string[] = [];
    for (const cf of CONTEXT_FILES) {
      const exists = await context.fileExists(cf);
      if (exists) {
        foundContextFiles.push(cf);
      }
    }

    if (foundContextFiles.length === 0) {
      findings.push({
        code: "ARI-CTX-001",
        severity: "high",
        pillar: PILLAR,
        message: "No agent context files found (AGENTS.md, CLAUDE.md, .cursorrules, etc.)",
        remediation: {
          action: "create-file",
          path: "AGENTS.md",
          description: "Create an AGENTS.md file with project-specific context for AI coding agents",
          estimatedImpact: "+12 points composite",
          confidence: "high",
        },
        evidence: {
          paper: "Lulla et al., 2026",
          finding: "Quality AGENTS.md reduces agent time 28.6%, tokens 16.6%",
          confidence: "high",
        },
      });
    } else {
      // Base score boost for having context files
      score += 15 * Math.min(foundContextFiles.length, 3);

      // Check AGENTS.md quality if it exists
      if (foundContextFiles.includes("AGENTS.md")) {
        const content = await context.readFile("AGENTS.md");
        if (content) {
          const lines = content.split("\n").length;
          const hasHeadings = /^#+\s/m.test(content);
          const hasCodeBlocks = /```/.test(content);
          const hasDontStatements = /\b(don't|do not|never|avoid)\b/i.test(content);

          if (lines < 10) {
            findings.push({
              code: "ARI-CTX-002",
              severity: "medium",
              pillar: PILLAR,
              message: "AGENTS.md is too short (< 10 lines). Effective context files provide detailed project-specific guidance.",
              remediation: {
                action: "modify-config",
                path: "AGENTS.md",
                description: "Expand AGENTS.md with architecture overview, conventions, and common pitfalls",
                confidence: "high",
              },
            });
          } else {
            score += 10;
          }

          if (hasHeadings) score += 5;
          if (hasCodeBlocks) score += 5;
          if (hasDontStatements) score += 5; // Negative instructions are valuable
        }
      }

      // Check for .agentignore
      if (foundContextFiles.includes(".agentignore")) {
        score += 10;
      } else {
        findings.push({
          code: "ARI-CTX-003",
          severity: "low",
          pillar: PILLAR,
          message: "No .agentignore file found. This file helps agents exclude irrelevant files from context.",
          remediation: {
            action: "create-file",
            path: ".agentignore",
            description: "Create .agentignore to exclude generated files, vendor code, and binaries from agent context",
            confidence: "medium",
          },
        });
      }
    }

    // Check README quality as context baseline
    const readme = await context.readFile("README.md");
    if (readme) {
      const readmeLines = readme.split("\n").length;
      if (readmeLines > 20) score += 5;
    } else {
      findings.push({
        code: "ARI-CTX-004",
        severity: "medium",
        pillar: PILLAR,
        message: "No README.md found. README serves as baseline context for all agents.",
        remediation: {
          action: "create-file",
          path: "README.md",
          description: "Create a README.md with project overview, setup instructions, and architecture summary",
          confidence: "high",
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
      summary: foundContextFiles.length > 0
        ? `Found ${foundContextFiles.length} context file(s): ${foundContextFiles.join(", ")}`
        : "No agent context files found",
    };
  },
};

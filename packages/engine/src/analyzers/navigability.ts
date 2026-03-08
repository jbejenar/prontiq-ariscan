import { type PillarId, PILLAR_NAMES, PILLAR_WEIGHTS, type Finding } from "@prontiq/schema";
import type { PillarAnalyzer, RepoContext } from "./analyzer.interface.js";

const PILLAR: PillarId = "P7";

export const navigabilityAnalyzer: PillarAnalyzer = {
  pillar: PILLAR,
  name: PILLAR_NAMES[PILLAR],
  version: "0.1.0",

  async supports(): Promise<boolean> {
    return true;
  },

  async analyze(context: RepoContext) {
    const findings: Finding[] = [];
    let score = 50; // Start at midpoint and adjust

    const sourceFiles = context.files.filter(
      (f) => /\.[jt]sx?$|\.py$|\.go$|\.java$|\.cs$|\.rb$|\.rs$/.test(f) &&
        !f.includes("node_modules") &&
        !f.includes("dist/") &&
        !f.includes("build/"),
    );

    if (sourceFiles.length === 0) {
      return {
        pillar: PILLAR,
        name: PILLAR_NAMES[PILLAR],
        score: 50,
        weight: PILLAR_WEIGHTS[PILLAR],
        confidence: "low",
        findings: [],
        summary: "No source files to analyze for navigability",
      };
    }

    // Directory structure analysis
    const dirs = new Map<string, number>();
    for (const f of sourceFiles) {
      const dir = f.split("/").slice(0, -1).join("/") || ".";
      dirs.set(dir, (dirs.get(dir) ?? 0) + 1);
    }

    // Check for overstuffed directories (>20 files)
    const stuffedDirs = [...dirs.entries()].filter(([_, count]) => count > 20);
    const firstStuffed = stuffedDirs[0];
    if (firstStuffed) {
      score -= 10;
      const [dirName, dirCount] = firstStuffed;
      findings.push({
        code: "ARI-NAV-001",
        severity: "medium",
        pillar: PILLAR,
        file: dirName,
        message: `Directory "${dirName}" has ${dirCount} source files — consider splitting into submodules`,
        remediation: {
          action: "refactor",
          description: "Split large directories into focused submodules with clear boundaries",
          confidence: "medium",
        },
      });
    } else {
      score += 10;
    }

    // Directory depth analysis
    const depths = sourceFiles.map((f) => f.split("/").length);
    const maxDepth = Math.max(...depths);
    if (maxDepth > 8) {
      score -= 10;
      findings.push({
        code: "ARI-NAV-002",
        severity: "low",
        pillar: PILLAR,
        message: `Maximum directory depth is ${maxDepth} — deep nesting hurts navigation`,
        remediation: {
          action: "refactor",
          description: "Flatten deeply nested directory structures. Aim for max depth of 5-6.",
          confidence: "low",
        },
      });
    } else if (maxDepth <= 5) {
      score += 5;
    }

    // Module boundary clarity (src/ structure)
    const hasSrcDir = context.files.some((f) => f.startsWith("src/"));
    const hasPackagesDir = context.files.some((f) => f.startsWith("packages/"));
    if (hasSrcDir || hasPackagesDir) {
      score += 10;
    }

    // Naming consistency
    const fileNames = sourceFiles.map((f) => f.split("/").pop() ?? f);
    const camelCase = fileNames.filter((f) => /^[a-z][a-zA-Z]+\.[a-z]+$/.test(f)).length;
    const kebabCase = fileNames.filter((f) => /^[a-z][a-z0-9-]+\.[a-z]+$/.test(f)).length;
    const snakeCase = fileNames.filter((f) => /^[a-z][a-z0-9_]+\.[a-z]+$/.test(f)).length;
    const pascalCase = fileNames.filter((f) => /^[A-Z][a-zA-Z]+\.[a-z]+$/.test(f)).length;

    const styles = [
      { name: "camelCase", count: camelCase },
      { name: "kebab-case", count: kebabCase },
      { name: "snake_case", count: snakeCase },
      { name: "PascalCase", count: pascalCase },
    ];
    const dominant = styles.reduce((a, b) => (a.count > b.count ? a : b));
    const total = styles.reduce((a, b) => a + b.count, 0);
    const consistency = total > 0 ? dominant.count / total : 0;

    if (consistency >= 0.8) {
      score += 10;
    } else if (consistency < 0.5 && total > 5) {
      score -= 5;
      findings.push({
        code: "ARI-NAV-003",
        severity: "low",
        pillar: PILLAR,
        message: `Inconsistent file naming: ${styles.filter((s) => s.count > 0).map((s) => `${s.name}(${s.count})`).join(", ")}`,
        remediation: {
          action: "refactor",
          description: `Standardize file naming to ${dominant.name}`,
          confidence: "low",
        },
        evidence: {
          paper: "Microsoft, 2023",
          finding: "Consistent naming decreases defects 40%",
          confidence: "medium",
        },
      });
    }

    // Index/barrel files (good for navigation)
    const indexFiles = context.files.filter(
      (f) => /index\.[jt]sx?$|mod\.rs$|__init__\.py$/.test(f),
    );
    if (indexFiles.length > 0 && dirs.size > 3) {
      const barrelRatio = indexFiles.length / dirs.size;
      if (barrelRatio >= 0.5) {
        score += 5;
      }
    }

    score = Math.min(100, Math.max(0, score));

    return {
      pillar: PILLAR,
      name: PILLAR_NAMES[PILLAR],
      score,
      weight: PILLAR_WEIGHTS[PILLAR],
      confidence: sourceFiles.length > 10 ? "medium" : "low",
      findings,
      summary: `${sourceFiles.length} source files across ${dirs.size} directories, max depth ${maxDepth}, naming ${Math.round(consistency * 100)}% consistent`,
    };
  },
};

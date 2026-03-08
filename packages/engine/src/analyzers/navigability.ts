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
      (f) =>
        /\.[jt]sx?$|\.py$|\.go$|\.java$|\.cs$|\.rb$|\.rs$/.test(f) &&
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
        message: `Inconsistent file naming: ${styles
          .filter((s) => s.count > 0)
          .map((s) => `${s.name}(${s.count})`)
          .join(", ")}`,
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
    const indexFiles = context.files.filter((f) =>
      /index\.[jt]sx?$|mod\.rs$|__init__\.py$/.test(f),
    );
    if (indexFiles.length > 0 && dirs.size > 3) {
      const barrelRatio = indexFiles.length / dirs.size;
      if (barrelRatio >= 0.5) {
        score += 5;
      }
    }

    // Import analysis — count imports per file, flag files with >20 imports
    const importableFiles = sourceFiles.filter((f) => /\.[jt]sx?$|\.py$/.test(f));
    const sampledForImports = importableFiles.slice(0, 30);
    let heavyImportCount = 0;

    for (const file of sampledForImports) {
      const content = await context.readFile(file);
      if (!content) continue;

      const importLines = content
        .split("\n")
        .filter((line) => /^\s*(import\s|from\s|require\s*\()/.test(line));

      if (importLines.length > 20) {
        heavyImportCount++;
        if (heavyImportCount <= 3) {
          findings.push({
            code: "ARI-NAV-004",
            severity: "medium",
            pillar: PILLAR,
            file,
            message: `File has ${importLines.length} imports — high coupling, consider splitting`,
            remediation: {
              action: "refactor",
              description:
                "Reduce imports by splitting the file into smaller focused modules or using barrel imports",
              confidence: "medium",
            },
          });
        }
      }
    }

    if (heavyImportCount === 0 && sampledForImports.length > 0) {
      score += 5;
    } else if (heavyImportCount > 3) {
      score -= 10;
    } else if (heavyImportCount > 0) {
      score -= 5;
    }

    // Basic circular dependency heuristic (files that import each other)
    const importMap = new Map<string, Set<string>>();
    const tsJsFiles = sourceFiles.filter((f) => /\.[jt]sx?$/.test(f));
    const sampledForCircular = tsJsFiles.slice(0, 30);

    for (const file of sampledForCircular) {
      const content = await context.readFile(file);
      if (!content) continue;

      const imports = new Set<string>();
      const importRegex = /(?:import\s.*?from\s+['"](.+?)['"]|require\s*\(\s*['"](.+?)['"]\s*\))/g;
      let match: RegExpExecArray | null;
      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1] ?? match[2];
        if (importPath && importPath.startsWith(".")) {
          // Resolve relative import to approximate file path
          const fileDir = file.split("/").slice(0, -1).join("/");
          const segments = importPath.replace(/\.[jt]sx?$/, "").split("/");
          const resolved: string[] = fileDir ? fileDir.split("/") : [];
          for (const seg of segments) {
            if (seg === "..") {
              resolved.pop();
            } else if (seg !== ".") {
              resolved.push(seg);
            }
          }
          imports.add(resolved.join("/"));
        }
      }
      importMap.set(file, imports);
    }

    // Detect mutual imports
    let circularCount = 0;
    for (const [fileA, importsA] of importMap) {
      const fileABase = fileA.replace(/\.[jt]sx?$/, "");
      for (const [fileB, importsB] of importMap) {
        if (fileA >= fileB) continue; // avoid double-counting
        const fileBBase = fileB.replace(/\.[jt]sx?$/, "");
        const aImportsB = [...importsA].some((imp) => imp === fileBBase || imp === fileB);
        const bImportsA = [...importsB].some((imp) => imp === fileABase || imp === fileA);
        if (aImportsB && bImportsA) {
          circularCount++;
          if (circularCount <= 2) {
            findings.push({
              code: "ARI-NAV-005",
              severity: "high",
              pillar: PILLAR,
              message: `Potential circular dependency between "${fileA}" and "${fileB}"`,
              remediation: {
                action: "refactor",
                description:
                  "Break the circular dependency by extracting shared code into a separate module",
                confidence: "low",
              },
            });
          }
        }
      }
    }

    if (circularCount === 0 && sampledForCircular.length > 5) {
      score += 5;
    } else if (circularCount > 0) {
      score -= Math.min(15, circularCount * 5);
    }

    // --- ARI-NAV-006: Dead code detection heuristic ---
    // Collect all import references from sampled files
    const allImportTargets = new Set<string>();
    for (const [, imports] of importMap) {
      for (const imp of imports) {
        allImportTargets.add(imp);
      }
    }

    // Also scan additional files not yet in importMap for import targets
    const additionalFiles = tsJsFiles.filter((f) => !importMap.has(f)).slice(0, 20);
    for (const file of additionalFiles) {
      const content = await context.readFile(file);
      if (!content) continue;
      const importRegex = /(?:import\s.*?from\s+['"](.+?)['"]|require\s*\(\s*['"](.+?)['"]\s*\))/g;
      let match: RegExpExecArray | null;
      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1] ?? match[2];
        if (importPath && importPath.startsWith(".")) {
          const fileDir = file.split("/").slice(0, -1).join("/");
          const segments = importPath.replace(/\.[jt]sx?$/, "").split("/");
          const resolved: string[] = fileDir ? fileDir.split("/") : [];
          for (const seg of segments) {
            if (seg === "..") {
              resolved.pop();
            } else if (seg !== ".") {
              resolved.push(seg);
            }
          }
          allImportTargets.add(resolved.join("/"));
        }
      }
    }

    const deadCodeCandidates: string[] = [];
    const entryPatterns =
      /index\.[jt]sx?$|main\.[jt]sx?$|app\.[jt]sx?$|mod\.rs$|__init__\.py$|server\.[jt]sx?$/;
    const sampledForDead = tsJsFiles.slice(0, 30);
    for (const file of sampledForDead) {
      const fileName = file.split("/").pop() ?? "";
      // Skip entry points and index files
      if (entryPatterns.test(fileName)) continue;
      // Skip test files
      if (/\.test\.|\.spec\.|__tests__/.test(file)) continue;

      const fileBase = file.replace(/\.[jt]sx?$/, "");
      const isImported = [...allImportTargets].some(
        (imp) => imp === fileBase || imp === file || fileBase.endsWith("/" + imp.split("/").pop()),
      );
      if (!isImported) {
        deadCodeCandidates.push(file);
      }
    }

    if (deadCodeCandidates.length > 3) {
      score -= 5;
      findings.push({
        code: "ARI-NAV-006",
        severity: "low",
        pillar: PILLAR,
        message: `Found ${deadCodeCandidates.length} source file(s) that appear unused (never imported): ${deadCodeCandidates.slice(0, 3).join(", ")}${deadCodeCandidates.length > 3 ? ` and ${deadCodeCandidates.length - 3} more` : ""}`,
        remediation: {
          action: "refactor",
          description:
            "Review potentially dead code files and remove them or ensure they are properly imported",
          confidence: "low",
        },
      });
    }

    // --- ARI-NAV-007: Cognitive complexity estimate ---
    const complexFiles: Array<{ file: string; reason: string }> = [];
    const sampledForComplexity = importableFiles.slice(0, 20);

    for (const file of sampledForComplexity) {
      const content = await context.readFile(file);
      if (!content) continue;

      const lines = content.split("\n");

      // Count nested conditionals depth
      let maxNestingDepth = 0;
      let currentNesting = 0;
      for (const line of lines) {
        const trimmed = line.trim();
        if (
          /^(if|else if|else|switch|for|while|try|catch)\b/.test(trimmed) ||
          /\{\s*$/.test(trimmed)
        ) {
          currentNesting++;
          if (currentNesting > maxNestingDepth) {
            maxNestingDepth = currentNesting;
          }
        }
        if (/^\}/.test(trimmed)) {
          currentNesting = Math.max(0, currentNesting - 1);
        }
      }

      // Check for long functions (>50 lines between function boundaries)
      let inFunction = false;
      let functionStartLine = 0;
      let hasLongFunction = false;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line === undefined) continue;
        const trimmed = line.trim();
        if (
          /^(export\s+)?(async\s+)?function\b|^(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?\(/.test(
            trimmed,
          )
        ) {
          inFunction = true;
          functionStartLine = i;
        }
        if (inFunction && /^\};\s*$|^\}\s*$/.test(trimmed) && i - functionStartLine > 50) {
          hasLongFunction = true;
          inFunction = false;
        }
      }

      if (maxNestingDepth >= 5) {
        complexFiles.push({ file, reason: `nesting depth ${maxNestingDepth}` });
      } else if (hasLongFunction) {
        complexFiles.push({ file, reason: "long function (>50 lines)" });
      }
    }

    if (complexFiles.length > 0) {
      score -= Math.min(10, complexFiles.length * 3);
      const topComplex = complexFiles.slice(0, 3);
      findings.push({
        code: "ARI-NAV-007",
        severity: "medium",
        pillar: PILLAR,
        message: `Found ${complexFiles.length} file(s) with high cognitive complexity: ${topComplex.map((c) => `${c.file} (${c.reason})`).join(", ")}`,
        remediation: {
          action: "refactor",
          description: "Reduce nesting depth and break long functions into smaller, focused units",
          confidence: "medium",
        },
      });
    }

    // Build summary with "most costly navigation paths"
    const problemAreas: string[] = [];
    if (stuffedDirs.length > 0) {
      problemAreas.push(`${stuffedDirs.length} overstuffed dir(s)`);
    }
    if (heavyImportCount > 0) {
      problemAreas.push(`${heavyImportCount} high-coupling file(s)`);
    }
    if (circularCount > 0) {
      problemAreas.push(`${circularCount} circular dep(s)`);
    }
    if (deadCodeCandidates.length > 0) {
      problemAreas.push(`${deadCodeCandidates.length} potentially dead file(s)`);
    }
    if (complexFiles.length > 0) {
      problemAreas.push(`${complexFiles.length} high-complexity file(s)`);
    }

    const costlyPaths =
      problemAreas.length > 0
        ? ` | Top issues: ${problemAreas.join(", ")}`
        : " | No major navigation issues";

    score = Math.min(100, Math.max(0, score));

    return {
      pillar: PILLAR,
      name: PILLAR_NAMES[PILLAR],
      score,
      weight: PILLAR_WEIGHTS[PILLAR],
      confidence: sourceFiles.length > 10 ? "medium" : "low",
      findings,
      summary: `${sourceFiles.length} source files across ${dirs.size} directories, max depth ${maxDepth}, naming ${Math.round(consistency * 100)}% consistent${costlyPaths}`,
    };
  },
};

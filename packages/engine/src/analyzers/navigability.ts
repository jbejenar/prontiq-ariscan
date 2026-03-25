import { type PillarId, PILLAR_NAMES, type Finding } from "@prontiq/ariscan-schema";
import type { PillarAnalyzer, RepoContext } from "./analyzer.interface.js";
import { buildPillarResult } from "./shared.js";
import { buildDependencyGraph } from "../graph/graph-builder.js";
import { analyzeGraph } from "../graph/graph-analyzer.js";

const PILLAR: PillarId = "P7";

/** Extracted function with name and body text */
interface ExtractedFunction {
  name: string;
  body: string;
}

/**
 * Extract top-level function definitions from source code using brace-matching.
 * Handles: function declarations, arrow functions assigned to const/let/var,
 * class methods, and exported variants.
 */
function extractFunctions(content: string): ExtractedFunction[] {
  const lines = content.split("\n");
  // Cap at 50 functions per file and only scan first 2000 lines
  const MAX_FUNCTIONS = 50;
  const MAX_SCAN_LINES = 2000;
  const functions: ExtractedFunction[] = [];
  let i = 0;

  while (i < lines.length && i < MAX_SCAN_LINES && functions.length < MAX_FUNCTIONS) {
    const line = lines[i];
    if (line === undefined) {
      i++;
      continue;
    }
    const trimmed = line.trim();

    // Match function declarations, arrow functions, and class methods.
    // Order matters: most specific first.
    const fnDeclMatch = trimmed.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
    // Arrow with => on same line: const foo = (args) => {
    const arrowMatch = trimmed.match(
      /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>\s*\{/,
    );
    // Class method: methodName(args) {
    const methodMatch = trimmed.match(/^(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\S+\s*)?\{/);

    const name = fnDeclMatch?.[1] ?? arrowMatch?.[1] ?? methodMatch?.[1];

    if (
      name &&
      name !== "if" &&
      name !== "for" &&
      name !== "while" &&
      name !== "switch" &&
      name !== "catch" &&
      name !== "else"
    ) {
      // Find the opening brace on this line or subsequent lines
      let braceStart = i;
      let foundBrace = false;
      let searchLine = trimmed;

      // Look up to 3 lines ahead for the opening brace
      for (let look = 0; look < 3 && i + look < lines.length; look++) {
        const lookLine = lines[i + look];
        if (lookLine === undefined) continue;
        if (lookLine.includes("{")) {
          braceStart = i + look;
          searchLine = lookLine;
          foundBrace = true;
          break;
        }
      }

      if (foundBrace) {
        // Count braces to find the end of the function (max 500 lines to avoid runaway)
        const MAX_BODY_LINES = 200;
        const bodyLines: string[] = [];
        let j = braceStart;

        // Count braces on a line, skipping those inside string literals and comments
        const countBraces = (ln: string): { open: number; close: number } => {
          let open = 0;
          let close = 0;
          let inSingle = false;
          let inDouble = false;
          let inTemplate = false;
          for (let c = 0; c < ln.length; c++) {
            const ch = ln[c];
            const prev = c > 0 ? ln[c - 1] : "";
            if (prev === "\\") continue;
            if (ch === "'" && !inDouble && !inTemplate) {
              inSingle = !inSingle;
              continue;
            }
            if (ch === '"' && !inSingle && !inTemplate) {
              inDouble = !inDouble;
              continue;
            }
            if (ch === "`" && !inSingle && !inDouble) {
              inTemplate = !inTemplate;
              continue;
            }
            if (inSingle || inDouble || inTemplate) continue;
            // Skip line comments
            if (ch === "/" && c + 1 < ln.length && ln[c + 1] === "/") break;
            if (ch === "{") open++;
            if (ch === "}") close++;
          }
          return { open, close };
        };

        const initial = countBraces(searchLine);
        let braceDepth = initial.open - initial.close;
        bodyLines.push(searchLine);

        if (braceDepth > 0) {
          j++;
          while (j < lines.length && braceDepth > 0 && bodyLines.length < MAX_BODY_LINES) {
            const bodyLine = lines[j];
            if (bodyLine !== undefined) {
              bodyLines.push(bodyLine);
              const b = countBraces(bodyLine);
              braceDepth += b.open - b.close;
            }
            j++;
          }
        }

        // Only record if we found the closing brace (braceDepth == 0)
        if (braceDepth === 0) {
          functions.push({ name, body: bodyLines.join("\n") });
        }
        i = j;
        continue;
      }
    }
    i++;
  }

  return functions;
}

/**
 * Compute cognitive complexity for a function body.
 * Based on SonarSource cognitive complexity metric:
 * - +1 for each control flow break (if, else if, else, switch, for, while, catch, ternary)
 * - +1 nesting increment per level of nesting for nested control flow
 * - +1 for each boolean operator sequence (&&, ||)
 */
function computeCognitiveComplexity(body: string): number {
  const lines = body.split("\n");
  let complexity = 0;
  let nestingLevel = 0;

  // Track brace depth to approximate nesting of control structures
  const controlFlowPattern = /^\s*(if|else\s+if|else|switch|for|while|do|catch)\b/;
  const ternaryPattern = /\?[^:?]*:/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;

    // Check for control flow structures
    const cfMatch = trimmed.match(controlFlowPattern);
    if (cfMatch) {
      const keyword = cfMatch[1];
      // "else" and "else if" get +1 but no nesting penalty
      if (keyword === "else") {
        complexity += 1;
      } else if (keyword === "else if") {
        complexity += 1;
      } else {
        // if, switch, for, while, do, catch: +1 base + nesting penalty
        complexity += 1 + nestingLevel;
      }

      // If this line opens a brace, it increases nesting for subsequent lines
      if (trimmed.includes("{")) {
        nestingLevel++;
      }
    } else {
      // Track brace-based nesting for non-control-flow lines
      if (trimmed.includes("{") && !trimmed.startsWith("//") && !trimmed.startsWith("*")) {
        nestingLevel++;
      }
    }

    if (trimmed.includes("}")) {
      // Count closing braces to handle multiple on same line
      const closingCount = (trimmed.match(/\}/g) ?? []).length;
      const openingCount = (trimmed.match(/\{/g) ?? []).length;
      // Only decrease for net closings, and only if we didn't already count the opening above
      const netClose = closingCount - openingCount;
      if (netClose > 0 && !cfMatch) {
        nestingLevel = Math.max(0, nestingLevel - netClose);
      } else if (netClose > 0 && cfMatch) {
        // Control flow line with net close: the open was counted above, close excess
        nestingLevel = Math.max(0, nestingLevel - netClose);
      }
    }

    // Boolean operator sequences: +1 per chain
    const boolOps = trimmed.match(/&&|\|\|/g);
    if (boolOps) {
      complexity += boolOps.length;
    }

    // Ternary operator: +1 per occurrence
    const ternaries = trimmed.match(ternaryPattern);
    if (ternaries) {
      complexity += 1;
    }
  }

  return complexity;
}

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
      return buildPillarResult(
        PILLAR,
        0,
        "low",
        [
          {
            code: "ARI-NAV-100",
            severity: "info",
            pillar: PILLAR,
            message:
              "No source files matching known extensions found — navigability analysis requires source code",
            scoreImpact: { pillarDelta: 0, compositeDelta: 0 },
          },
        ],
        "Insufficient data: no source files to analyze for navigability",
        [
          "Shippey et al., 2022 — Cognitive complexity >15 correlates with 3x higher defect density",
          "Microsoft, 2023 — Consistent naming decreases defects 40%",
        ],
        "insufficient",
      );
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
        confidence: "medium",
        scoreImpact: { pillarDelta: -10, compositeDelta: 0 },
        remediation: {
          action: "refactor",
          description: "Split large directories into focused submodules with clear boundaries",
          confidence: "medium",
        },
        evidence: {
          paper: "Barr et al., 2015",
          finding:
            "Predictable project structure reduces code search time and improves retrieval accuracy for automated tools",
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
        confidence: "medium",
        scoreImpact: { pillarDelta: -10, compositeDelta: 0 },
        remediation: {
          action: "refactor",
          description: "Flatten deeply nested directory structures. Aim for max depth of 5-6.",
          confidence: "low",
        },
        evidence: {
          paper: "Barr et al., 2015",
          finding:
            "Predictable project structure reduces code search time and improves retrieval accuracy for automated tools",
          confidence: "medium",
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
        confidence: "low",
        scoreImpact: { pillarDelta: -5, compositeDelta: 0 },
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

    // === Graph-based dependency analysis (P3.07) ===
    // Build dependency graph and compute metrics using Tarjan's SCC algorithm,
    // fan-in/fan-out, cohesion, and boundary violation detection.
    const graph = await buildDependencyGraph(context, { maxFiles: 200 });
    const graphMetrics = analyzeGraph(graph);

    // --- Import analysis: use graph fan-out for heavy import detection ---
    const importableFiles = sourceFiles.filter((f) => /\.[jt]sx?$|\.py$/.test(f));
    const highFanOutModules = graphMetrics.fanMetrics.filter((m) => m.fanOut > 20);
    const heavyImportCount = highFanOutModules.length;

    for (const mod of highFanOutModules.slice(0, 3)) {
      findings.push({
        code: "ARI-NAV-004",
        severity: "medium",
        pillar: PILLAR,
        file: mod.path,
        message: `Module "${mod.path}" has ${mod.fanOut} dependencies — high coupling, consider splitting`,
        confidence: "medium",
        scoreImpact: { pillarDelta: -5, compositeDelta: 0 },
        remediation: {
          action: "refactor",
          description:
            "Reduce imports by splitting the file into smaller focused modules or using barrel imports",
          confidence: "medium",
        },
      });
    }

    if (heavyImportCount === 0 && importableFiles.length > 0) {
      score += 5;
    } else if (heavyImportCount > 3) {
      score -= 10;
    } else if (heavyImportCount > 0) {
      score -= 5;
    }

    // --- ARI-NAV-010: Circular dependency chains (Tarjan's SCC) ---
    // Also emits deprecated ARI-NAV-005 alias for backward compatibility
    const circularCount = graphMetrics.cycles.length;
    for (const cycle of graphMetrics.cycles.slice(0, 3)) {
      const chainStr = [...cycle.chain, cycle.chain[0]].join(" → ");
      findings.push({
        code: "ARI-NAV-010",
        severity: "high",
        pillar: PILLAR,
        message: `Circular dependency chain: ${chainStr}`,
        confidence: "high",
        scoreImpact: { pillarDelta: -5, compositeDelta: 0 },
        remediation: {
          action: "refactor",
          description:
            "Break the circular dependency by extracting shared types/interfaces into a separate module, or use dependency inversion",
          confidence: "high",
        },
        evidence: {
          paper: "arXiv 2601.08773, 2025",
          finding:
            "AST-derived dependency graphs achieve highest accuracy for multi-hop code reasoning; circular dependencies reduce graph navigability",
          confidence: "high",
        },
      });
      // Emit deprecated ARI-NAV-005 alias so existing suppression configs still work
      findings.push({
        code: "ARI-NAV-005",
        severity: "high",
        pillar: PILLAR,
        message: `[Deprecated → ARI-NAV-010] Circular dependency: ${chainStr}`,
        confidence: "high",
        scoreImpact: { pillarDelta: 0, compositeDelta: 0 },
        remediation: {
          action: "refactor",
          description:
            "ARI-NAV-005 is deprecated — use ARI-NAV-010 in suppression configs. Break the circular dependency by extracting shared types/interfaces.",
          confidence: "high",
        },
      });
    }

    if (circularCount === 0 && graph.nodes.size > 5) {
      score += 5;
    } else if (circularCount > 0) {
      score -= Math.min(15, circularCount * 5);
    }

    // --- ARI-NAV-011: Module cohesion ---
    const lowCohesionDirs = graphMetrics.cohesion.filter(
      (c) => c.ratio < 0.3 && c.internalDeps + c.externalDeps >= 3,
    );
    if (lowCohesionDirs.length > 0) {
      score -= 5;
      const examples = lowCohesionDirs
        .slice(0, 3)
        .map((c) => `${c.directory} (${Math.round(c.ratio * 100)}%)`)
        .join(", ");
      findings.push({
        code: "ARI-NAV-011",
        severity: "medium",
        pillar: PILLAR,
        message: `Low module cohesion in: ${examples} — files mostly depend on external modules`,
        confidence: "medium",
        scoreImpact: { pillarDelta: -5, compositeDelta: 0 },
        remediation: {
          action: "refactor",
          description:
            "Reorganize modules so files within a directory primarily depend on each other, moving cross-cutting concerns to shared utility modules",
          confidence: "medium",
        },
        evidence: {
          paper: "Fluree, 2025",
          finding:
            "GraphRAG achieves 3.4x accuracy improvement over vector RAG; high cohesion modules improve graph-based code retrieval",
          confidence: "medium",
        },
      });
    }

    // --- ARI-NAV-012: Elevated fan-out modules (15 < fanOut <= 20) ---
    // Only emit for the 15-20 range; modules with fanOut > 20 are covered by ARI-NAV-004 above.
    const elevatedFanOut = graphMetrics.fanMetrics.filter((m) => m.fanOut > 15 && m.fanOut <= 20);
    if (elevatedFanOut.length > 0) {
      score -= Math.min(5, elevatedFanOut.length * 2);
      const examples = elevatedFanOut
        .slice(0, 3)
        .map((m) => `${m.path} (${m.fanOut} deps)`)
        .join(", ");
      findings.push({
        code: "ARI-NAV-012",
        severity: "medium",
        pillar: PILLAR,
        message: `Elevated fan-out modules: ${examples} — approaching high coupling threshold`,
        confidence: "medium",
        scoreImpact: { pillarDelta: -2, compositeDelta: 0 },
        remediation: {
          action: "refactor",
          description:
            "Reduce fan-out by introducing intermediate abstraction layers or splitting responsibilities",
          confidence: "medium",
        },
        evidence: {
          paper: "SWE-agent (Yang et al., NeurIPS 2024)",
          finding:
            "Modules with high fan-out require more context for agents to reason about safely",
          confidence: "medium",
        },
      });
    }

    // --- ARI-NAV-006: Dead code detection using graph (modules with 0 fan-in) ---
    const entryPatterns =
      /index\.[jt]sx?$|main\.[jt]sx?$|app\.[jt]sx?$|mod\.rs$|__init__\.py$|server\.[jt]sx?$/;
    const configPatterns =
      /\.config\.[jt]sx?$|\.d\.[jt]s$|setup\.[jt]sx?$|cli\.[jt]sx?$|bin\.[jt]sx?$/;
    const conventionDirPatterns =
      /commands\/|scripts\/|migrations\/|seeds\/|fixtures\/|\.storybook\//;

    const deadCodeCandidates: string[] = [];
    for (const [path, node] of graph.nodes) {
      // Skip if anything imports this module
      if (node.importedBy.size > 0) continue;
      // Skip entry points
      const fileName = path.split("/").pop() ?? "";
      if (entryPatterns.test(fileName + ".ts")) continue;
      if (entryPatterns.test(fileName + ".js")) continue;
      // Skip test files
      if (/\.test|\.spec|__tests__/.test(path)) continue;
      // Skip config files
      if (configPatterns.test(fileName + ".ts")) continue;
      // Skip conventional dirs
      if (conventionDirPatterns.test(path)) continue;

      deadCodeCandidates.push(path);
    }

    if (deadCodeCandidates.length > 3) {
      score -= 5;
      findings.push({
        code: "ARI-NAV-006",
        severity: "low",
        pillar: PILLAR,
        message: `Found ${deadCodeCandidates.length} source file(s) that appear unused (never imported): ${deadCodeCandidates.slice(0, 3).join(", ")}${deadCodeCandidates.length > 3 ? ` and ${deadCodeCandidates.length - 3} more` : ""}`,
        confidence: "low",
        scoreImpact: { pillarDelta: -5, compositeDelta: 0 },
        remediation: {
          action: "refactor",
          description:
            "Review potentially dead code files and remove them or ensure they are properly imported",
          confidence: "low",
        },
      });
    }

    // --- ARI-NAV-007: Per-function cognitive complexity with aggregation ---
    interface FunctionComplexity {
      file: string;
      name: string;
      complexity: number;
      lineCount: number;
      label: "good" | "moderate" | "poor";
    }

    const allFunctionComplexities: FunctionComplexity[] = [];
    const sampledForComplexity = importableFiles.slice(0, 20);

    for (const file of sampledForComplexity) {
      const content = await context.readFile(file);
      if (!content) continue;

      const functions = extractFunctions(content);
      for (const fn of functions) {
        const complexity = computeCognitiveComplexity(fn.body);
        const label = complexity <= 8 ? "good" : complexity <= 15 ? "moderate" : "poor";
        allFunctionComplexities.push({
          file,
          name: fn.name,
          complexity,
          lineCount: fn.body.split("\n").length,
          label,
        });
      }
    }

    // Aggregate: sort by complexity descending, report top offenders
    allFunctionComplexities.sort((a, b) => b.complexity - a.complexity);
    const poorFunctions = allFunctionComplexities.filter((f) => f.label === "poor");
    const moderateFunctions = allFunctionComplexities.filter((f) => f.label === "moderate");

    if (poorFunctions.length > 0) {
      score -= Math.min(10, poorFunctions.length * 3);
      const topPoor = poorFunctions.slice(0, 5);
      findings.push({
        code: "ARI-NAV-007",
        severity: "high",
        pillar: PILLAR,
        message: `${poorFunctions.length} function(s) with poor cognitive complexity (>15): ${topPoor.map((c) => `${c.file}:${c.name} (${c.complexity})`).join(", ")}`,
        confidence: "medium",
        scoreImpact: { pillarDelta: -3, compositeDelta: 0 },
        remediation: {
          action: "refactor",
          description:
            "Break high-complexity functions into smaller, focused units. Reduce nesting depth and extract conditional logic into helper functions.",
          confidence: "high",
        },
        evidence: {
          paper: "Shippey et al., 2022",
          finding:
            "Cognitive complexity >15 correlates with 3x higher defect density and significantly slower agent comprehension",
          confidence: "medium",
        },
      });
    } else if (moderateFunctions.length > 3) {
      score -= Math.min(5, moderateFunctions.length);
      const topMod = moderateFunctions.slice(0, 3);
      findings.push({
        code: "ARI-NAV-007",
        severity: "medium",
        pillar: PILLAR,
        message: `${moderateFunctions.length} function(s) with moderate cognitive complexity (9-15): ${topMod.map((c) => `${c.file}:${c.name} (${c.complexity})`).join(", ")}`,
        confidence: "medium",
        scoreImpact: { pillarDelta: -1, compositeDelta: 0 },
        remediation: {
          action: "refactor",
          description:
            "Consider simplifying functions with moderate complexity by extracting nested logic",
          confidence: "medium",
        },
      });
    }

    // --- ARI-NAV-008: Code duplication / clone detection ---
    // Use normalized line-chunk hashing to detect near-duplicate code blocks
    const CHUNK_SIZE = 6; // consecutive normalized lines per chunk
    const chunkMap = new Map<string, string[]>(); // hash -> list of file paths
    const sampledForDuplication = sourceFiles.slice(0, 40);

    for (const file of sampledForDuplication) {
      const content = await context.readFile(file);
      if (!content) continue;

      // Normalize lines: trim, collapse whitespace, skip empty/comment/import lines
      const normalized = content
        .split("\n")
        .map((l) => l.trim())
        .filter(
          (l) =>
            l.length > 0 &&
            !/^\s*\/\//.test(l) &&
            !/^\s*\/?\*/.test(l) &&
            !/^\s*#/.test(l) &&
            !/^\s*(import|from|require|export)\b/.test(l) &&
            l !== "{" &&
            l !== "}" &&
            l !== "};",
        );

      // Create overlapping chunks
      for (let i = 0; i <= normalized.length - CHUNK_SIZE; i++) {
        const chunk = normalized.slice(i, i + CHUNK_SIZE).join("\n");
        const existing = chunkMap.get(chunk);
        if (existing) {
          if (!existing.includes(file)) {
            existing.push(file);
          }
        } else {
          chunkMap.set(chunk, [file]);
        }
      }
    }

    // Find files that share significant chunks with other files
    const duplicationPairs = new Map<string, Set<string>>(); // file -> set of files it shares chunks with
    let sharedChunkCount = 0;

    for (const [, files] of chunkMap) {
      if (files.length > 1) {
        sharedChunkCount++;
        for (const fileA of files) {
          for (const fileB of files) {
            if (fileA !== fileB) {
              const set = duplicationPairs.get(fileA) ?? new Set<string>();
              set.add(fileB);
              duplicationPairs.set(fileA, set);
            }
          }
        }
      }
    }

    // Count files involved in duplication and compute ratio
    const filesWithDuplication = duplicationPairs.size;
    const duplicationRatio =
      sampledForDuplication.length > 0 ? filesWithDuplication / sampledForDuplication.length : 0;

    if (duplicationRatio > 0.4 || filesWithDuplication > 8) {
      // High duplication: significant penalty
      score -= 10;
      const topPairs = [...duplicationPairs.entries()]
        .sort((a, b) => b[1].size - a[1].size)
        .slice(0, 3);
      const examples = topPairs
        .map(([file, peers]) => `${file} ↔ ${[...peers].slice(0, 2).join(", ")}`)
        .join("; ");
      findings.push({
        code: "ARI-NAV-008",
        severity: "medium",
        pillar: PILLAR,
        message: `Detected code duplication across ${filesWithDuplication} file(s) (${sharedChunkCount} shared block(s)): ${examples}`,
        confidence: "low",
        scoreImpact: { pillarDelta: -10, compositeDelta: 0 },
        remediation: {
          action: "refactor",
          description:
            "Extract duplicated code into shared utilities or base classes to reduce maintenance burden and improve agent navigability",
          confidence: "medium",
        },
        evidence: {
          paper: "Fowler, 2018",
          finding:
            "Code duplication is a primary source of maintenance burden and increases defect propagation risk",
          confidence: "medium",
        },
      });
    } else if (duplicationRatio > 0.2 || filesWithDuplication > 4) {
      // Moderate duplication: mild penalty
      score -= 5;
      findings.push({
        code: "ARI-NAV-008",
        severity: "low",
        pillar: PILLAR,
        message: `Minor code duplication detected in ${filesWithDuplication} file(s) (${sharedChunkCount} shared block(s))`,
        confidence: "low",
        scoreImpact: { pillarDelta: -5, compositeDelta: 0 },
        remediation: {
          action: "refactor",
          description:
            "Consider extracting repeated patterns into shared modules to improve maintainability",
          confidence: "low",
        },
      });
    }

    // --- ARI-NAV-009: Structural clarity for retrieval ---
    // Evaluate predictable patterns that help agents find code: barrel files, layer separation
    const allBarrelFiles = context.files.filter((f) =>
      /index\.[jt]sx?$|mod\.rs$|__init__\.py$/.test(f),
    );
    const dirsWithBarrels = new Set(
      allBarrelFiles.map((f) => f.split("/").slice(0, -1).join("/") || "."),
    );
    const barrelCoverage = dirs.size > 0 ? dirsWithBarrels.size / dirs.size : 0;

    // Check for conventional layer directories that aid navigation
    const layerDirs = [
      "src",
      "lib",
      "utils",
      "services",
      "models",
      "components",
      "controllers",
      "handlers",
      "middleware",
      "types",
      "schemas",
      "config",
    ];
    const presentLayers = layerDirs.filter((d) =>
      context.files.some((f) => f.startsWith(d + "/") || f.includes("/" + d + "/")),
    );
    const hasLayerSeparation = presentLayers.length >= 3;

    const structuralClarityGood = barrelCoverage >= 0.4 && hasLayerSeparation;
    const structuralClarityModerate = barrelCoverage >= 0.2 || hasLayerSeparation;

    if (structuralClarityGood) {
      score += 5;
      findings.push({
        code: "ARI-NAV-009",
        severity: "info",
        pillar: PILLAR,
        message: `Good structural clarity: ${dirsWithBarrels.size}/${dirs.size} directories have barrel/index files, ${presentLayers.length} conventional layers detected`,
        confidence: "medium",
        scoreImpact: { pillarDelta: 0, compositeDelta: 0 },
      });
    } else if (!structuralClarityModerate) {
      score -= 5;
      findings.push({
        code: "ARI-NAV-009",
        severity: "medium",
        pillar: PILLAR,
        message: `Low structural clarity for retrieval: ${dirsWithBarrels.size}/${dirs.size} directories have barrel/index files${presentLayers.length < 3 ? ", few conventional layer directories" : ""}`,
        confidence: "low",
        scoreImpact: { pillarDelta: -5, compositeDelta: 0 },
        remediation: {
          action: "refactor",
          description:
            "Add barrel/index files to module directories and organize code into conventional layers (src/, utils/, services/, models/) for predictable navigation",
          confidence: "low",
        },
        evidence: {
          paper: "Barr et al., 2015",
          finding:
            "Predictable project structure reduces code search time and improves retrieval accuracy for automated tools",
          confidence: "medium",
        },
      });
    }

    const structuralClarityLabel: "good" | "moderate" | "poor" = structuralClarityGood
      ? "good"
      : structuralClarityModerate
        ? "moderate"
        : "poor";

    // --- Threshold labels for all metrics (AC#2) ---
    const maxFilesPerDir =
      stuffedDirs.length > 0
        ? Math.max(...stuffedDirs.map(([, c]) => c))
        : Math.max(...[...dirs.values()]);
    const dirSizeLabel: "good" | "moderate" | "poor" =
      maxFilesPerDir <= 20 ? "good" : maxFilesPerDir <= 30 ? "moderate" : "poor";
    const depthLabel: "good" | "moderate" | "poor" =
      maxDepth <= 5 ? "good" : maxDepth <= 8 ? "moderate" : "poor";
    const namingLabel: "good" | "moderate" | "poor" =
      consistency >= 0.8 ? "good" : consistency >= 0.5 ? "moderate" : "poor";
    const importLabel: "good" | "moderate" | "poor" =
      heavyImportCount === 0 ? "good" : heavyImportCount <= 3 ? "moderate" : "poor";
    const circularLabel: "good" | "poor" = circularCount === 0 ? "good" : "poor";
    const cohesionLabel: "good" | "moderate" | "poor" =
      lowCohesionDirs.length === 0 ? "good" : lowCohesionDirs.length <= 2 ? "moderate" : "poor";
    const deadCodeLabel: "good" | "moderate" | "poor" =
      deadCodeCandidates.length <= 1
        ? "good"
        : deadCodeCandidates.length <= 3
          ? "moderate"
          : "poor";
    const duplicationLabel: "good" | "moderate" | "poor" =
      duplicationRatio <= 0.2 && filesWithDuplication <= 4
        ? "good"
        : duplicationRatio <= 0.4 && filesWithDuplication <= 8
          ? "moderate"
          : "poor";

    // Build summary with "most costly navigation paths"
    const problemAreas: string[] = [];
    if (stuffedDirs.length > 0) {
      problemAreas.push(`${stuffedDirs.length} overstuffed dir(s)`);
    }
    if (heavyImportCount > 0) {
      problemAreas.push(`${heavyImportCount} high-coupling file(s)`);
    }
    if (circularCount > 0) {
      problemAreas.push(`${circularCount} circular dep chain(s)`);
    }
    if (deadCodeCandidates.length > 0) {
      problemAreas.push(`${deadCodeCandidates.length} potentially dead file(s)`);
    }
    if (poorFunctions.length > 0) {
      problemAreas.push(`${poorFunctions.length} high-complexity function(s)`);
    } else if (moderateFunctions.length > 3) {
      problemAreas.push(`${moderateFunctions.length} moderate-complexity function(s)`);
    }
    if (filesWithDuplication > 0) {
      problemAreas.push(`${filesWithDuplication} file(s) with duplicated code`);
    }

    const costlyPaths =
      problemAreas.length > 0
        ? ` | Top issues: ${problemAreas.join(", ")}`
        : " | No major navigation issues";

    const thresholdSummary = `depth:${depthLabel} dirs:${dirSizeLabel} naming:${namingLabel} imports:${importLabel} circular:${circularLabel} cohesion:${cohesionLabel} dead-code:${deadCodeLabel} duplication:${duplicationLabel} structure:${structuralClarityLabel}`;

    return buildPillarResult(
      PILLAR,
      score,
      sourceFiles.length > 10 ? "medium" : "low",
      findings,
      `${sourceFiles.length} source files across ${dirs.size} directories, max depth ${maxDepth}, naming ${Math.round(consistency * 100)}% consistent | Graph: ${graph.nodes.size} modules, ${graph.edgeCount} edges, ${circularCount} cycles, clarity ${graphMetrics.structuralClarity}/100 | Thresholds: ${thresholdSummary}${costlyPaths}`,
      [
        "arXiv 2601.08773, 2025 — AST-derived knowledge graphs achieve highest accuracy for multi-hop code reasoning",
        "Fluree, 2025 — GraphRAG achieves 3.4x accuracy improvement over vector RAG",
        "SWE-agent (Yang et al., NeurIPS 2024) — Agent navigation correlates with codebase structural clarity",
        "Shippey et al., 2022 — Cognitive complexity >15 correlates with 3x higher defect density",
        "Microsoft, 2023 — Consistent naming decreases defects 40%",
      ],
    );
  },
};

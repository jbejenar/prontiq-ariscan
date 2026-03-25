/**
 * Build a dependency graph from source files by extracting imports.
 */

import type { RepoContext } from "../analyzers/analyzer.interface.js";
import { extractImports, detectExtractorLanguage } from "./import-extractor.js";
import type { DependencyGraph, ModuleNode } from "./types.js";

/** Options for graph construction. */
export interface GraphBuildOptions {
  /** Maximum number of files to scan (default: 200) */
  maxFiles?: number;
  /** Include package (non-relative) imports in the graph (default: false) */
  includeExternal?: boolean;
}

/** Normalize a file path to a module key (strip extension). */
function toModuleKey(filePath: string): string {
  return filePath.replace(/\.[jt]sx?$|\.py$|\.pyi$|\.go$|\.java$|\.cs$|\.rs$|\.rb$/, "");
}

/**
 * Build a dependency graph from source files in a RepoContext.
 *
 * Scans source files, extracts import statements, resolves relative paths,
 * and builds an adjacency graph with fan-in/fan-out tracking.
 */
export async function buildDependencyGraph(
  context: RepoContext,
  options: GraphBuildOptions = {},
): Promise<DependencyGraph> {
  const { maxFiles = 200, includeExternal = false } = options;

  // Filter to supported source files
  const sourceFiles = context.files.filter(
    (f) =>
      /\.[jt]sx?$|\.py$|\.go$|\.java$/.test(f) &&
      !f.includes("node_modules") &&
      !f.includes("dist/") &&
      !f.includes("build/") &&
      !/\.test\.|\.spec\.|__tests__/.test(f),
  );

  const filesToScan = sourceFiles.slice(0, maxFiles);

  // Maps for building the graph
  const importsMap = new Map<string, Set<string>>(); // module → set of modules it imports
  const importedByMap = new Map<string, Set<string>>(); // module → set of modules that import it

  // Ensure all scanned files have entries
  for (const file of filesToScan) {
    const key = toModuleKey(file);
    if (!importsMap.has(key)) importsMap.set(key, new Set());
  }

  // Extract imports from each file
  for (const file of filesToScan) {
    const lang = detectExtractorLanguage(file);
    if (lang === "unknown") continue;

    const content = await context.readFile(file);
    if (!content) continue;

    const fileImports = extractImports(content, file);
    const sourceKey = toModuleKey(file);

    for (const imp of fileImports) {
      if (imp.kind === "package" && !includeExternal) continue;

      const targetKey = imp.kind === "relative" ? imp.target : imp.target;

      // Add to imports map
      const sourceImports = importsMap.get(sourceKey) ?? new Set<string>();
      sourceImports.add(targetKey);
      importsMap.set(sourceKey, sourceImports);

      // Add to importedBy map
      const targetImportedBy = importedByMap.get(targetKey) ?? new Set<string>();
      targetImportedBy.add(sourceKey);
      importedByMap.set(targetKey, targetImportedBy);

      // Ensure target has an imports entry
      if (!importsMap.has(targetKey)) importsMap.set(targetKey, new Set());
    }
  }

  // Build nodes
  const nodes = new Map<string, ModuleNode>();
  let edgeCount = 0;

  for (const [path, imports] of importsMap) {
    const importedBy = importedByMap.get(path) ?? new Set<string>();
    nodes.set(path, {
      path,
      imports,
      importedBy,
    });
    edgeCount += imports.size;
  }

  return { nodes, edgeCount };
}

/**
 * Extract import statements from source files using regex patterns.
 * Supports TypeScript/JavaScript, Python, Go, and Java.
 *
 * When tree-sitter WASM grammars are available, the tree-sitter extractor
 * provides higher accuracy. This regex extractor is the default fallback.
 */

import type { ImportInfo } from "./types.js";

/** Detected language for import extraction. */
export type ExtractorLanguage = "typescript" | "python" | "go" | "java" | "unknown";

/** Detect language from file extension. */
export function detectExtractorLanguage(filePath: string): ExtractorLanguage {
  if (/\.[jt]sx?$|\.mts$|\.cts$|\.mjs$|\.cjs$/.test(filePath)) return "typescript";
  if (/\.py$|\.pyi$/.test(filePath)) return "python";
  if (/\.go$/.test(filePath)) return "go";
  if (/\.java$/.test(filePath)) return "java";
  return "unknown";
}

/**
 * Resolve a relative import path to a normalized module path.
 * E.g., from "src/a.ts" importing "./b" → "src/b"
 */
export function resolveRelativeImport(sourceFile: string, importPath: string): string {
  // Strip file extension from import path
  const cleaned = importPath.replace(/\.[jt]sx?$|\.py$|\.go$|\.java$/, "");
  const segments = cleaned.split("/");
  const sourceDir = sourceFile.split("/").slice(0, -1);
  const resolved: string[] = [...sourceDir];

  for (const seg of segments) {
    if (seg === "..") {
      resolved.pop();
    } else if (seg !== ".") {
      resolved.push(seg);
    }
  }

  return resolved.join("/");
}

/** Extract imports from TypeScript/JavaScript source code. */
function extractTypeScriptImports(content: string, filePath: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const lines = content.split("\n");

  // ES module imports: import ... from '...'
  // CommonJS: require('...')
  // Re-exports: export ... from '...'
  const importRegex =
    /(?:import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\)|export\s+(?:\*|\{[^}]*\})\s+from\s+['"]([^'"]+)['"])/g;

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip comments
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;

    let match: RegExpExecArray | null;
    importRegex.lastIndex = 0;
    while ((match = importRegex.exec(line)) !== null) {
      const importPath = match[1] ?? match[2] ?? match[3];
      if (!importPath) continue;

      if (importPath.startsWith(".")) {
        imports.push({
          sourceFile: filePath,
          target: resolveRelativeImport(filePath, importPath),
          kind: "relative",
        });
      } else {
        imports.push({
          sourceFile: filePath,
          target: importPath,
          kind: "package",
        });
      }
    }
  }

  return imports;
}

/** Extract imports from Python source code. */
function extractPythonImports(content: string, filePath: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) continue;

    // from .module import name (relative)
    const fromRelMatch = trimmed.match(/^from\s+(\.+\w*(?:\.\w+)*)\s+import\b/);
    if (fromRelMatch?.[1]) {
      const dots = fromRelMatch[1].match(/^\.+/)?.[0] ?? ".";
      const modulePart = fromRelMatch[1].slice(dots.length);
      const sourceDir = filePath.split("/").slice(0, -1);
      const upLevels = dots.length - 1;
      const base = sourceDir.slice(0, sourceDir.length - upLevels);
      if (modulePart) {
        base.push(...modulePart.split("."));
      }
      imports.push({
        sourceFile: filePath,
        target: base.join("/"),
        kind: "relative",
      });
      continue;
    }

    // from package.module import name (absolute)
    const fromAbsMatch = trimmed.match(/^from\s+(\w+(?:\.\w+)*)\s+import\b/);
    if (fromAbsMatch?.[1]) {
      imports.push({
        sourceFile: filePath,
        target: fromAbsMatch[1].replace(/\./g, "/"),
        kind: "package",
      });
      continue;
    }

    // import module
    const importMatch = trimmed.match(/^import\s+(\w+(?:\.\w+)*)/);
    if (importMatch?.[1]) {
      imports.push({
        sourceFile: filePath,
        target: importMatch[1].replace(/\./g, "/"),
        kind: "package",
      });
    }
  }

  return imports;
}

/** Extract imports from Go source code. */
function extractGoImports(content: string, filePath: string): ImportInfo[] {
  const imports: ImportInfo[] = [];

  // Single import: import "path"
  const singleImportRegex = /import\s+"([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = singleImportRegex.exec(content)) !== null) {
    if (match[1]) {
      imports.push({
        sourceFile: filePath,
        target: match[1],
        kind: "package",
      });
    }
  }

  // Grouped imports: import ( "path1" \n "path2" )
  const groupRegex = /import\s*\(([\s\S]*?)\)/g;
  while ((match = groupRegex.exec(content)) !== null) {
    const body = match[1];
    if (!body) continue;
    const pathRegex = /["']([^"']+)["']/g;
    let pathMatch: RegExpExecArray | null;
    while ((pathMatch = pathRegex.exec(body)) !== null) {
      if (pathMatch[1]) {
        imports.push({
          sourceFile: filePath,
          target: pathMatch[1],
          kind: "package",
        });
      }
    }
  }

  return imports;
}

/** Extract imports from Java source code. */
function extractJavaImports(content: string, filePath: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    const importMatch = trimmed.match(/^import\s+(?:static\s+)?([a-zA-Z][\w.]*\w);?\s*$/);
    if (importMatch?.[1]) {
      imports.push({
        sourceFile: filePath,
        target: importMatch[1].replace(/\./g, "/"),
        kind: "package",
      });
    }
  }

  return imports;
}

/**
 * Extract all imports from a source file.
 * Returns an array of ImportInfo describing each import relationship.
 */
export function extractImports(content: string, filePath: string): ImportInfo[] {
  const lang = detectExtractorLanguage(filePath);

  switch (lang) {
    case "typescript":
      return extractTypeScriptImports(content, filePath);
    case "python":
      return extractPythonImports(content, filePath);
    case "go":
      return extractGoImports(content, filePath);
    case "java":
      return extractJavaImports(content, filePath);
    default:
      return [];
  }
}

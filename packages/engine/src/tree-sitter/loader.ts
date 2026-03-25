/**
 * Tree-sitter WASM grammar loader with lazy initialization and graceful fallback.
 *
 * If web-tree-sitter is not installed or WASM grammar files are not found,
 * all operations return null and the system falls back to regex-based parsing.
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

/** Supported languages for tree-sitter parsing. */
export type TreeSitterLanguage =
  | "typescript"
  | "javascript"
  | "python"
  | "go"
  | "java"
  | "rust"
  | "c_sharp"
  | "ruby";

/** Map from language to WASM file name. */
const GRAMMAR_FILES: Record<TreeSitterLanguage, string> = {
  typescript: "tree-sitter-typescript.wasm",
  javascript: "tree-sitter-javascript.wasm",
  python: "tree-sitter-python.wasm",
  go: "tree-sitter-go.wasm",
  java: "tree-sitter-java.wasm",
  rust: "tree-sitter-rust.wasm",
  c_sharp: "tree-sitter-c-sharp.wasm",
  ruby: "tree-sitter-ruby.wasm",
};

/** Cached parser instance (null = not yet initialized, false = failed) */
let parserModule: unknown = null;
let initAttempted = false;

/** Cached language instances. */
const languageCache = new Map<string, unknown>();

/** Directory where WASM grammars are expected. */
function getGrammarsDir(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  // Check both source layout and dist layout
  const candidates = [
    join(currentDir, "..", "..", "grammars"),
    join(currentDir, "..", "grammars"),
    join(currentDir, "grammars"),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  return candidates[0] ?? "";
}

/**
 * Check if tree-sitter is available (web-tree-sitter installed + at least one grammar).
 */
export async function isTreeSitterAvailable(): Promise<boolean> {
  if (initAttempted) return parserModule !== null && parserModule !== false;

  initAttempted = true;
  try {
    // Dynamic import to make web-tree-sitter optional.
    // Use a variable to prevent TypeScript from resolving the module at compile time.
    const moduleName = "web-tree-sitter";
    const mod = await import(/* @vite-ignore */ moduleName);
    const Parser = mod.default ?? mod;
    await Parser.init();
    parserModule = Parser;

    // Check if any grammar files exist
    const grammarsDir = getGrammarsDir();
    const hasGrammars = Object.values(GRAMMAR_FILES).some((file) =>
      existsSync(join(grammarsDir, file)),
    );
    if (!hasGrammars) {
      parserModule = false;
      return false;
    }

    return true;
  } catch {
    parserModule = false;
    return false;
  }
}

/**
 * Load a tree-sitter language grammar.
 * Returns null if tree-sitter is not available or the grammar is not found.
 */
export async function loadLanguage(lang: TreeSitterLanguage): Promise<unknown> {
  const cached = languageCache.get(lang);
  if (cached) return cached;

  const available = await isTreeSitterAvailable();
  if (!available || !parserModule) return null;

  const grammarFile = GRAMMAR_FILES[lang];
  if (!grammarFile) return null;

  const grammarPath = join(getGrammarsDir(), grammarFile);
  if (!existsSync(grammarPath)) return null;

  try {
    const Parser = parserModule as { Language: { load: (path: string) => Promise<unknown> } };
    const language = await Parser.Language.load(grammarPath);
    languageCache.set(lang, language);
    return language;
  } catch {
    return null;
  }
}

/**
 * Get the list of available grammar languages.
 */
export function getAvailableLanguages(): TreeSitterLanguage[] {
  const grammarsDir = getGrammarsDir();
  const available: TreeSitterLanguage[] = [];

  for (const [lang, file] of Object.entries(GRAMMAR_FILES)) {
    if (existsSync(join(grammarsDir, file))) {
      available.push(lang as TreeSitterLanguage);
    }
  }

  return available;
}

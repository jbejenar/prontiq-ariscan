import type { RepoContext } from "../analyzers/analyzer.interface.js";

/**
 * Create a mock RepoContext from an in-memory file map.
 * Keys are relative file paths, values are file contents (string) or null for binary.
 */
export function createMockContext(
  files: Record<string, string | null>,
  rootPath: string = "/mock/repo",
): RepoContext {
  const filePaths = Object.keys(files).sort();

  return {
    rootPath,
    files: Object.freeze(filePaths),
    async readFile(relativePath: string): Promise<string | null> {
      if (relativePath in files) {
        return files[relativePath] ?? null;
      }
      return null;
    },
    async fileExists(relativePath: string): Promise<boolean> {
      // Check exact match or directory prefix
      if (relativePath in files) return true;
      // Check if it's a directory (any file starts with this path)
      return filePaths.some((f) => f.startsWith(relativePath + "/") || f === relativePath);
    },
    async readJson<T = unknown>(relativePath: string): Promise<T | null> {
      const content = files[relativePath];
      if (content === undefined || content === null) return null;
      try {
        return JSON.parse(content) as T;
      } catch {
        return null;
      }
    },
  };
}

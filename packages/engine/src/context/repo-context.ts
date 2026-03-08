import { readFile as fsReadFile, access } from "node:fs/promises";
import { join } from "node:path";
import fg from "fast-glob";
import type { RepoContext } from "../analyzers/analyzer.interface.js";

async function readFileContent(rootPath: string, relativePath: string): Promise<string | null> {
  try {
    const content = await fsReadFile(join(rootPath, relativePath), "utf-8");
    return content;
  } catch {
    return null;
  }
}

/**
 * Create a RepoContext from a filesystem path.
 */
export async function createRepoContext(rootPath: string): Promise<RepoContext> {
  const files = await fg(["**/*"], {
    cwd: rootPath,
    dot: true,
    ignore: [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/build/**",
      "**/.turbo/**",
      "**/coverage/**",
    ],
    onlyFiles: true,
  });

  return {
    rootPath,
    files: Object.freeze(files.sort()),
    async readFile(relativePath: string): Promise<string | null> {
      return readFileContent(rootPath, relativePath);
    },
    async fileExists(relativePath: string): Promise<boolean> {
      try {
        await access(join(rootPath, relativePath));
        return true;
      } catch {
        return false;
      }
    },
    async readJson<T = unknown>(relativePath: string): Promise<T | null> {
      const content = await readFileContent(rootPath, relativePath);
      if (content === null) return null;
      try {
        return JSON.parse(content) as T;
      } catch {
        return null;
      }
    },
  };
}

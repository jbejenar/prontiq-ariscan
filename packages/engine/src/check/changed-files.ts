/**
 * Git-based changed file detection for pre-commit check mode (P3.04).
 *
 * Detects staged and unstaged changes relative to HEAD or a specified base.
 * Falls back gracefully when not in a git repository.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Run a git command in the given directory and return stdout lines. */
async function gitLines(repoPath: string, args: string[]): Promise<string[]> {
  const { stdout } = await execFileAsync("git", args, {
    cwd: repoPath,
    timeout: 10_000,
  });
  return stdout
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/**
 * Get files changed in the working tree (staged + unstaged) relative to HEAD.
 * This is the default for pre-commit hooks: "what will this commit change?"
 */
export async function getChangedFiles(repoPath: string): Promise<string[]> {
  try {
    const [staged, unstaged] = await Promise.all([
      gitLines(repoPath, ["diff", "--name-only", "--cached"]),
      gitLines(repoPath, ["diff", "--name-only"]),
    ]);
    // Also include untracked files
    const untracked = await gitLines(repoPath, ["ls-files", "--others", "--exclude-standard"]);
    const unique = new Set([...staged, ...unstaged, ...untracked]);
    return [...unique].sort();
  } catch {
    // Not a git repo or git not available — return empty (caller should fall back to full scan)
    return [];
  }
}

/**
 * Get files changed between the current HEAD and a base ref (branch or commit).
 * Useful for PR-level delta checks.
 */
export async function getChangedFilesFromBase(
  repoPath: string,
  base: string = "HEAD~1",
): Promise<string[]> {
  try {
    return await gitLines(repoPath, ["diff", "--name-only", base]);
  } catch {
    return [];
  }
}

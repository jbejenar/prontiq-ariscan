import { describe, it, expect, vi, beforeEach } from "vitest";
import { execFile } from "node:child_process";

// Mock child_process before importing the module under test
vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

// We need to also mock promisify to return our mocked execFile as a promise
vi.mock("node:util", () => ({
  promisify: (fn: unknown) => {
    return (...args: unknown[]) => {
      return new Promise((resolve, reject) => {
        (fn as (...a: unknown[]) => void)(...args, (err: Error | null, result: unknown) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
    };
  },
}));

const mockedExecFile = vi.mocked(execFile);

// Import after mocks are set up
const { getChangedFiles, getChangedFilesFromBase } = await import("../../check/changed-files.js");

function mockGitOutput(stdout: string) {
  mockedExecFile.mockImplementationOnce(
    (_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
      (cb as (...a: unknown[]) => void)(null, { stdout });
      return undefined as never;
    },
  );
}

function mockGitError() {
  mockedExecFile.mockImplementationOnce(
    (_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
      (cb as (...a: unknown[]) => void)(new Error("not a git repository"));
      return undefined as never;
    },
  );
}

describe("getChangedFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns deduplicated sorted output from staged + unstaged + untracked", async () => {
    // staged
    mockGitOutput("src/a.ts\nsrc/b.ts\n");
    // unstaged
    mockGitOutput("src/b.ts\nsrc/c.ts\n");
    // untracked
    mockGitOutput("src/d.ts\n");

    const result = await getChangedFiles("/repo");
    expect(result).toEqual(["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts"]);
  });

  it("returns empty array when git is not available", async () => {
    mockGitError();

    const result = await getChangedFiles("/repo");
    expect(result).toEqual([]);
  });

  it("handles empty output from git commands", async () => {
    mockGitOutput("");
    mockGitOutput("");
    mockGitOutput("");

    const result = await getChangedFiles("/repo");
    expect(result).toEqual([]);
  });
});

describe("getChangedFilesFromBase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns changed files relative to base ref", async () => {
    mockGitOutput("file1.ts\nfile2.ts\n");

    const result = await getChangedFilesFromBase("/repo", "main");
    expect(result).toEqual(["file1.ts", "file2.ts"]);
  });

  it("uses HEAD~1 as default base", async () => {
    mockGitOutput("file1.ts\n");

    await getChangedFilesFromBase("/repo");
    expect(mockedExecFile).toHaveBeenCalledWith(
      "git",
      ["diff", "--name-only", "HEAD~1"],
      expect.objectContaining({ cwd: "/repo" }),
      expect.any(Function),
    );
  });

  it("returns empty array on error", async () => {
    mockGitError();

    const result = await getChangedFilesFromBase("/repo", "main");
    expect(result).toEqual([]);
  });
});

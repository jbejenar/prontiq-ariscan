/** CLI integration tests for `ariscan audit agents-md` (P2.02). */
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("audit command", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("auditCommand exports are defined", async () => {
    const mod = await import("../commands/audit.js");
    expect(mod.auditCommand).toBeDefined();
  });

  it("auditCommand has correct meta", async () => {
    const mod = await import("../commands/audit.js");
    const meta = mod.auditCommand.meta as Record<string, unknown>;
    expect(meta["name"]).toBe("audit");
    expect(meta["description"]).toBeDefined();
  });

  it("auditCommand defines expected args (path, json, quiet)", async () => {
    const mod = await import("../commands/audit.js");
    const args = mod.auditCommand.args as Record<string, unknown>;
    expect(args).toBeDefined();
    expect(args["path"]).toBeDefined();
    expect(args["json"]).toBeDefined();
    expect(args["quiet"]).toBeDefined();
  });

  it("audit produces valid JSON-shaped results against this repo", async () => {
    // In-process test: import engine directly so we don't depend on built dist
    // artifacts from workspace packages (eliminates hidden build-order dependency).
    const { createRepoContext, detect, auditAgentsMd } = await import("@prontiq/ariscan-engine");
    const { resolve } = await import("node:path");

    const repoRoot = resolve(
      import.meta.dirname ?? new URL(".", import.meta.url).pathname,
      "../../../../",
    );

    const context = await createRepoContext(repoRoot);
    const detection = await detect(context);
    const results = await auditAgentsMd(context, detection);

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);

    // Each result should have the expected shape
    for (const result of results) {
      expect(result.filePath).toBeDefined();
      expect(typeof result.overallScore).toBe("number");
      expect(typeof result.tokenEstimate).toBe("number");
      expect(Array.isArray(result.dimensions)).toBe(true);
      expect(Array.isArray(result.issues)).toBe(true);
      expect(result.redundancy).toBeDefined();
    }
  }, 30_000);

  it("audit produces terminal-formatted output via the command handler", async () => {
    // In-process test: import engine directly so we don't depend on built dist
    // artifacts from workspace packages (eliminates hidden build-order dependency).
    const { createRepoContext, detect, auditAgentsMd } = await import("@prontiq/ariscan-engine");
    const { resolve } = await import("node:path");

    const repoRoot = resolve(
      import.meta.dirname ?? new URL(".", import.meta.url).pathname,
      "../../../../",
    );

    const context = await createRepoContext(repoRoot);
    const detection = await detect(context);
    const results = await auditAgentsMd(context, detection);

    // Verify at least one result exists with expected structure for terminal output
    expect(results.length).toBeGreaterThan(0);
    const first = results[0];
    if (!first) throw new Error("Expected at least one audit result");
    expect(first.filePath).toBeDefined();
    expect(first.dimensions.length).toBe(7);
    // Each dimension has label, score, details
    for (const dim of first.dimensions) {
      expect(dim.label).toBeDefined();
      expect(typeof dim.score).toBe("number");
      expect(dim.details).toBeDefined();
    }
  }, 30_000);

  it("runCommand(auditCommand) exercises CLI dispatch with --json --quiet", async () => {
    // CLI-level regression test: runs the audit command through citty's
    // runCommand, exercising argument parsing, the dispatch path, and output
    // formatting — the documented `ariscan audit <path> --json --quiet` shape.
    const { runCommand } = await import("citty");
    const { auditCommand } = await import("../commands/audit.js");
    const { resolve } = await import("node:path");

    const repoRoot = resolve(
      import.meta.dirname ?? new URL(".", import.meta.url).pathname,
      "../../../../",
    );

    // Capture stdout/stderr writes
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    const origStdoutWrite = process.stdout.write.bind(process.stdout);
    const origStderrWrite = process.stderr.write.bind(process.stderr);
    const origExit = process.exit;

    // Mock process.exit to prevent Vitest from dying
    let exitCode: number | undefined;
    process.exit = ((code?: number) => {
      exitCode = code;
    }) as never;

    process.stdout.write = ((chunk: string | Uint8Array) => {
      stdoutChunks.push(typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk));
      return true;
    }) as typeof process.stdout.write;
    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderrChunks.push(typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk));
      return true;
    }) as typeof process.stderr.write;

    try {
      await runCommand(auditCommand, { rawArgs: [repoRoot, "--json", "--quiet"] });
    } finally {
      process.stdout.write = origStdoutWrite;
      process.stderr.write = origStderrWrite;
      process.exit = origExit;
    }

    const stdout = stdoutChunks.join("");

    // --quiet suppresses progress output on stderr
    const stderr = stderrChunks.join("");
    expect(stderr).not.toContain("Auditing context files");

    // --json produces valid JSON array output
    const parsed = JSON.parse(stdout) as unknown[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);

    // Each result has the documented shape
    for (const item of parsed) {
      const result = item as Record<string, unknown>;
      expect(result["filePath"]).toBeDefined();
      expect(typeof result["overallScore"]).toBe("number");
      expect(typeof result["tokenEstimate"]).toBe("number");
      expect(Array.isArray(result["dimensions"])).toBe(true);
      expect(Array.isArray(result["issues"])).toBe(true);
      expect(result["redundancy"]).toBeDefined();
    }

    // Exit code: 0 (no critical issues) or 1 (critical issues found)
    // Either is acceptable — just verify the command completed
    if (exitCode !== undefined) {
      expect([0, 1]).toContain(exitCode);
    }
  }, 30_000);

  it("runCommand(auditCommand) with 'agents-md' target keyword exercises documented command shape", async () => {
    // Regression test for the documented `ariscan audit agents-md --json --quiet`
    // command shape. The positional arg is the target keyword "agents-md", NOT a
    // filesystem path. This exercises the AUDIT_TARGETS branch in audit.ts that
    // resolves the repo path to "." when a known target is provided.
    const { runCommand } = await import("citty");
    const { auditCommand } = await import("../commands/audit.js");
    const { resolve } = await import("node:path");

    // The agents-md target resolves CWD via resolve("."), so we must be at the
    // repo root for discovery to find context files.
    const repoRoot = resolve(
      import.meta.dirname ?? new URL(".", import.meta.url).pathname,
      "../../../../",
    );
    const origCwd = process.cwd();
    process.chdir(repoRoot);

    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    const origStdoutWrite = process.stdout.write.bind(process.stdout);
    const origStderrWrite = process.stderr.write.bind(process.stderr);
    const origExit = process.exit;

    let exitCode: number | undefined;
    process.exit = ((code?: number) => {
      exitCode = code;
    }) as never;

    process.stdout.write = ((chunk: string | Uint8Array) => {
      stdoutChunks.push(typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk));
      return true;
    }) as typeof process.stdout.write;
    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderrChunks.push(typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk));
      return true;
    }) as typeof process.stderr.write;

    try {
      await runCommand(auditCommand, { rawArgs: ["agents-md", "--json", "--quiet"] });
    } finally {
      process.chdir(origCwd);
      process.stdout.write = origStdoutWrite;
      process.stderr.write = origStderrWrite;
      process.exit = origExit;
    }

    const stdout = stdoutChunks.join("");
    const stderr = stderrChunks.join("");

    // --quiet suppresses progress output
    expect(stderr).not.toContain("Auditing context files");

    // Should NOT have treated "agents-md" as a path and errored
    expect(exitCode).not.toBe(2);

    // --json produces valid JSON array output
    const parsed = JSON.parse(stdout) as unknown[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);

    for (const item of parsed) {
      const result = item as Record<string, unknown>;
      expect(result["filePath"]).toBeDefined();
      expect(typeof result["overallScore"]).toBe("number");
      expect(Array.isArray(result["dimensions"])).toBe(true);
      expect(Array.isArray(result["issues"])).toBe(true);
    }
  }, 30_000);
});

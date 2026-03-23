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

  it("audit command runs with --json flag against this repo", async () => {
    const { execFile } = await import("node:child_process");
    const { resolve } = await import("node:path");
    const { promisify } = await import("node:util");

    const execFileAsync = promisify(execFile);
    const cliSrc = resolve(
      import.meta.dirname ?? new URL(".", import.meta.url).pathname,
      "../cli.ts",
    );

    // Run `tsx <cli source> audit agents-md --json --quiet` against this repo
    const repoRoot = resolve(
      import.meta.dirname ?? new URL(".", import.meta.url).pathname,
      "../../../../",
    );

    let stdout: string;
    try {
      const result = await execFileAsync(
        "npx",
        ["tsx", cliSrc, "audit", "agents-md", "--json", "--quiet"],
        {
          cwd: repoRoot,
          timeout: 30_000,
        },
      );
      stdout = result.stdout;
    } catch (error: unknown) {
      // Exit code 1 is expected if there are critical issues — stdout still has JSON
      const execErr = error as { stdout?: string; code?: number };
      if (execErr.stdout) {
        stdout = execErr.stdout;
      } else {
        throw error;
      }
    }

    // Output should be valid JSON array
    const parsed = JSON.parse(stdout) as Array<Record<string, unknown>>;
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);

    // Each result should have the expected shape
    for (const result of parsed) {
      expect(result["filePath"]).toBeDefined();
      expect(typeof result["overallScore"]).toBe("number");
      expect(typeof result["tokenEstimate"]).toBe("number");
      expect(Array.isArray(result["dimensions"])).toBe(true);
      expect(Array.isArray(result["issues"])).toBe(true);
      expect(result["redundancy"]).toBeDefined();
    }
  }, 30_000);

  it("audit command runs with path argument and produces terminal output", async () => {
    const { execFile } = await import("node:child_process");
    const { resolve } = await import("node:path");
    const { promisify } = await import("node:util");

    const execFileAsync = promisify(execFile);
    const cliSrc = resolve(
      import.meta.dirname ?? new URL(".", import.meta.url).pathname,
      "../cli.ts",
    );
    const repoRoot = resolve(
      import.meta.dirname ?? new URL(".", import.meta.url).pathname,
      "../../../../",
    );

    let stdout: string;
    let stderr: string;
    try {
      const result = await execFileAsync("npx", ["tsx", cliSrc, "audit", repoRoot], {
        cwd: repoRoot,
        timeout: 30_000,
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (error: unknown) {
      const execErr = error as { stdout?: string; stderr?: string };
      stdout = execErr.stdout ?? "";
      stderr = execErr.stderr ?? "";
    }

    // Terminal output should mention "Audit:" and a score
    const combined = stdout + stderr;
    expect(combined).toContain("Audit");
  }, 30_000);
});

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
});

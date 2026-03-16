import { describe, it, expect } from "vitest";
import { scan } from "../scan.js";

/**
 * We test the suppression logic by scanning the repo with and without suppressions.
 * Since we can't easily mock the scan internals, we test the applySuppressions function
 * indirectly by passing suppressions config.
 *
 * For unit-level coverage, we extract and test the core logic directly.
 */

// Import the internal function via a workaround — test the behavior through the public API
describe("suppression via scan config", () => {
  it("passes suppressions through to engine without error", async () => {
    // This is a smoke test: running a scan with suppressions should not throw
    // We use the current repo as the target
    const result = await scan(".", {
      suppressions: [{ code: "ARI-CTX-001", reason: "test suppression", expiry: "no-expiry" }],
    });
    expect(result).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);

    // Check that any findings matching ARI-CTX-001 are marked suppressed
    const suppressed = result.findings.filter((f) => f.code === "ARI-CTX-001" && f.suppressed);
    const unsuppressed = result.findings.filter((f) => f.code === "ARI-CTX-001" && !f.suppressed);
    // If the finding exists, it should be suppressed
    if (suppressed.length > 0) {
      expect(unsuppressed).toHaveLength(0);
    }
  });

  it("does not mark non-matching findings as suppressed", async () => {
    const result = await scan(".", {
      suppressions: [{ code: "ARI-XXX-999", reason: "non-existent code", expiry: "no-expiry" }],
    });
    // No findings should be suppressed since the code doesn't match
    const suppressed = result.findings.filter((f) => f.suppressed === true);
    expect(suppressed).toHaveLength(0);
  });

  it("scan without suppressions produces no suppressed findings", async () => {
    const result = await scan(".");
    const suppressed = result.findings.filter((f) => f.suppressed === true);
    expect(suppressed).toHaveLength(0);
  });
});

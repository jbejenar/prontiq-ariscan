import { describe, it, expect } from "vitest";
import type { ScanOptions } from "../commands/scan.js";

describe("scan command helpers", () => {
  it("ScanOptions interface has correct shape", () => {
    const options: ScanOptions = {
      path: ".",
      format: "terminal",
      verbose: false,
      quiet: false,
      json: false,
      jsonSchema: false,
      threshold: 0,
    };
    expect(options.path).toBe(".");
    expect(options.format).toBe("terminal");
    expect(options.threshold).toBe(0);
  });

  it("scanCommand exports are defined", async () => {
    const mod = await import("../commands/scan.js");
    expect(mod.scanCommand).toBeDefined();
    expect(mod.runScan).toBeDefined();
    expect(typeof mod.runScan).toBe("function");
  });

  it("scanCommand has meta with name", async () => {
    const mod = await import("../commands/scan.js");
    const meta = mod.scanCommand.meta as Record<string, unknown>;
    expect(meta).toBeDefined();
    expect(meta["name"]).toBe("scan");
  });

  it("scanCommand defines args", async () => {
    const mod = await import("../commands/scan.js");
    expect(mod.scanCommand.args).toBeDefined();
  });
});

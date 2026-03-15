import { describe, it, expect } from "vitest";

describe("config command", () => {
  it("exports handleTelemetrySet function", async () => {
    const mod = await import("../commands/config.js");
    expect(mod.handleTelemetrySet).toBeDefined();
    expect(typeof mod.handleTelemetrySet).toBe("function");
  });

  it("exports handleTelemetryShow function", async () => {
    const mod = await import("../commands/config.js");
    expect(mod.handleTelemetryShow).toBeDefined();
    expect(typeof mod.handleTelemetryShow).toBe("function");
  });
});

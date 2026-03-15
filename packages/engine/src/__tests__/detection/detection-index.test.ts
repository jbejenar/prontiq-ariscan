import { describe, it, expect } from "vitest";
import { createMockContext } from "../helpers.js";

describe("detection module", () => {
  it("exports detect function", async () => {
    const mod = await import("../../detection/index.js");
    expect(mod.detect).toBeDefined();
    expect(typeof mod.detect).toBe("function");
  });

  it("detect returns structured result", async () => {
    const { detect } = await import("../../detection/index.js");
    const ctx = createMockContext({
      "package.json": '{"name":"test","dependencies":{"typescript":"5.0.0"}}',
      "src/index.ts": "export const x = 1;",
    });

    const result = await detect(ctx);
    expect(result).toBeDefined();
    expect(result.languages).toBeDefined();
    expect(Array.isArray(result.languages)).toBe(true);
    expect(result.frameworks).toBeDefined();
    expect(Array.isArray(result.frameworks)).toBe(true);
  });

  it("detects TypeScript when .ts files present", async () => {
    const { detect } = await import("../../detection/index.js");
    const ctx = createMockContext(
      {
        "package.json": '{"name":"test"}',
        "src/index.ts": "export const x = 1;",
        "src/utils.ts": "export const y = 2;",
      },
      ["tsconfig.json"],
    );

    const result = await detect(ctx);
    const ts = result.languages.find((l) => l.language === "TypeScript");
    expect(ts).toBeDefined();
  });
});

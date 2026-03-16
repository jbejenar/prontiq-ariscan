import { describe, it, expect } from "vitest";
import {
  ScanConfig,
  PillarOverride,
  FileConfig,
  EnforcementMode,
  Suppression,
  PillarThresholds,
  PolicyProfile,
  PathRule,
} from "../config.js";

describe("PillarOverride schema", () => {
  it("accepts valid override with all fields", () => {
    const result = PillarOverride.parse({ weight: 0.5, threshold: 80, enabled: true });
    expect(result.weight).toBe(0.5);
    expect(result.threshold).toBe(80);
    expect(result.enabled).toBe(true);
  });

  it("defaults enabled to true", () => {
    const result = PillarOverride.parse({});
    expect(result.enabled).toBe(true);
  });

  it("rejects weight outside 0-1", () => {
    expect(() => PillarOverride.parse({ weight: 1.5 })).toThrow();
    expect(() => PillarOverride.parse({ weight: -0.1 })).toThrow();
  });

  it("rejects threshold outside 0-100", () => {
    expect(() => PillarOverride.parse({ threshold: 101 })).toThrow();
    expect(() => PillarOverride.parse({ threshold: -1 })).toThrow();
  });
});

describe("ScanConfig schema", () => {
  it("provides sensible defaults", () => {
    const result = ScanConfig.parse({});
    expect(result.threshold).toBe(0);
    expect(result.format).toBe("terminal");
    expect(result.verbose).toBe(false);
    expect(result.quiet).toBe(false);
    expect(result.exclude).toEqual([]);
  });

  it("accepts all valid format options", () => {
    for (const format of ["terminal", "json", "sarif", "markdown"]) {
      const result = ScanConfig.parse({ format });
      expect(result.format).toBe(format);
    }
  });

  it("rejects invalid format", () => {
    expect(() => ScanConfig.parse({ format: "xml" })).toThrow();
  });

  it("accepts pillar overrides", () => {
    const result = ScanConfig.parse({
      pillars: {
        P1: { weight: 0.2, enabled: true },
        P3: { enabled: false },
      },
    });
    expect(result.pillars).toBeDefined();
    expect(result.pillars?.["P1"]?.weight).toBe(0.2);
    expect(result.pillars?.["P3"]?.enabled).toBe(false);
  });

  it("accepts targetLevel", () => {
    const result = ScanConfig.parse({ targetLevel: "L3" });
    expect(result.targetLevel).toBe("L3");
  });

  it("accepts suppressions", () => {
    const result = ScanConfig.parse({
      suppressions: [{ code: "ARI-CTX-001", reason: "accepted", expiry: "no-expiry" }],
    });
    expect(result.suppressions).toHaveLength(1);
  });
});

describe("EnforcementMode schema", () => {
  it("accepts valid modes", () => {
    expect(EnforcementMode.parse("warn")).toBe("warn");
    expect(EnforcementMode.parse("fail")).toBe("fail");
    expect(EnforcementMode.parse("block")).toBe("block");
  });

  it("rejects invalid mode", () => {
    expect(() => EnforcementMode.parse("ignore")).toThrow();
  });
});

describe("Suppression schema", () => {
  it("accepts valid suppression with date expiry", () => {
    const result = Suppression.parse({
      code: "ARI-CTX-001",
      reason: "Legacy module, accepted risk",
      expiry: "2026-12-31",
      approver: "team-lead",
    });
    expect(result.code).toBe("ARI-CTX-001");
    expect(result.expiry).toBe("2026-12-31");
    expect(result.approver).toBe("team-lead");
  });

  it("accepts no-expiry", () => {
    const result = Suppression.parse({
      code: "ARI-SEC-003",
      reason: "By design",
      expiry: "no-expiry",
    });
    expect(result.expiry).toBe("no-expiry");
  });

  it("rejects missing reason", () => {
    expect(() => Suppression.parse({ code: "ARI-CTX-001", expiry: "no-expiry" })).toThrow();
  });

  it("rejects empty reason", () => {
    expect(() =>
      Suppression.parse({ code: "ARI-CTX-001", reason: "", expiry: "no-expiry" }),
    ).toThrow();
  });

  it("rejects invalid finding code format", () => {
    expect(() =>
      Suppression.parse({ code: "INVALID", reason: "test", expiry: "no-expiry" }),
    ).toThrow();
  });

  it("rejects invalid expiry date", () => {
    expect(() =>
      Suppression.parse({ code: "ARI-CTX-001", reason: "test", expiry: "not-a-date" }),
    ).toThrow();
  });
});

describe("PillarThresholds schema", () => {
  it("accepts composite only", () => {
    const result = PillarThresholds.parse({ composite: 70 });
    expect(result.composite).toBe(70);
  });

  it("accepts per-pillar thresholds", () => {
    const result = PillarThresholds.parse({
      pillars: { P1: 60, P3: 80 },
    });
    expect(result.pillars?.P1).toBe(60);
    expect(result.pillars?.P3).toBe(80);
  });

  it("accepts both", () => {
    const result = PillarThresholds.parse({
      composite: 70,
      pillars: { P1: 60 },
    });
    expect(result.composite).toBe(70);
    expect(result.pillars?.P1).toBe(60);
  });

  it("accepts valid PillarId keys", () => {
    const result = PillarThresholds.parse({ pillars: { P1: 50, P2: 60 } });
    expect(result.pillars?.P1).toBe(50);
  });

  it("rejects invalid pillar IDs", () => {
    expect(() => PillarThresholds.parse({ pillars: { P9: 50 } })).toThrow();
    expect(() => PillarThresholds.parse({ pillars: { INVALID: 50 } })).toThrow();
  });
});

describe("PolicyProfile schema", () => {
  it("accepts valid profile", () => {
    const result = PolicyProfile.parse({
      name: "strict",
      thresholds: { composite: 80 },
      weights: { P1: 0.2, P2: 0.15 },
    });
    expect(result.name).toBe("strict");
  });

  it("rejects empty name", () => {
    expect(() => PolicyProfile.parse({ name: "" })).toThrow();
  });
});

describe("PathRule schema", () => {
  it("accepts valid path rule", () => {
    const result = PathRule.parse({
      pattern: "packages/legacy/**",
      thresholds: { composite: 40 },
      enforcement: "warn",
    });
    expect(result.pattern).toBe("packages/legacy/**");
    expect(result.enforcement).toBe("warn");
  });

  it("rejects empty pattern", () => {
    expect(() => PathRule.parse({ pattern: "" })).toThrow();
  });
});

describe("FileConfig schema (policy)", () => {
  it("accepts empty config (backward compat)", () => {
    const result = FileConfig.parse({});
    expect(result).toBeDefined();
  });

  it("accepts legacy flat threshold", () => {
    const result = FileConfig.parse({ threshold: 70 });
    expect(result.threshold).toBe(70);
  });

  it("accepts full policy config", () => {
    const result = FileConfig.parse({
      version: "1",
      enforcement: "fail",
      thresholds: {
        composite: 70,
        pillars: { P1: 60, P8: 40 },
      },
      suppressions: [{ code: "ARI-CTX-001", reason: "accepted", expiry: "2026-12-31" }],
      profiles: {
        strict: {
          name: "Strict CI",
          thresholds: { composite: 80 },
        },
      },
      activeProfile: "strict",
      paths: [{ pattern: "legacy/**", enforcement: "warn" }],
    });
    expect(result.enforcement).toBe("fail");
    expect(result.suppressions).toHaveLength(1);
    expect(result.profiles?.strict?.name).toBe("Strict CI");
    expect(result.paths).toHaveLength(1);
  });

  it("accepts both threshold and thresholds (backward compat)", () => {
    const result = FileConfig.parse({
      threshold: 70,
      thresholds: { composite: 80 },
    });
    expect(result.threshold).toBe(70);
    expect(result.thresholds?.composite).toBe(80);
  });

  it("accepts pillar exclusions (backward compat)", () => {
    const result = FileConfig.parse({
      pillars: { exclude: ["P1", "P8"] },
    });
    expect(result.pillars?.exclude).toEqual(["P1", "P8"]);
  });

  it("accepts pillar weight overrides (backward compat)", () => {
    const result = FileConfig.parse({
      pillars: { weights: { P1: 0.2, P3: 0.3 } },
    });
    expect(result.pillars?.weights?.["P1"]).toBe(0.2);
  });
});

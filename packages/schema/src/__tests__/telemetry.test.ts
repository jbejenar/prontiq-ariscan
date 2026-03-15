import { describe, it, expect } from "vitest";
import { ScoreBucket, scoreToBucket, telemetryPayloadSchema } from "../telemetry.js";

describe("ScoreBucket", () => {
  it("accepts valid bucket values", () => {
    for (const bucket of ["0-25", "26-45", "46-65", "66-80", "81-100"]) {
      expect(ScoreBucket.parse(bucket)).toBe(bucket);
    }
  });

  it("rejects invalid bucket", () => {
    expect(() => ScoreBucket.parse("0-50")).toThrow();
  });
});

describe("scoreToBucket", () => {
  it("maps 0 to 0-25", () => {
    expect(scoreToBucket(0)).toBe("0-25");
  });

  it("maps 25 to 0-25", () => {
    expect(scoreToBucket(25)).toBe("0-25");
  });

  it("maps 26 to 26-45", () => {
    expect(scoreToBucket(26)).toBe("26-45");
  });

  it("maps 45 to 26-45", () => {
    expect(scoreToBucket(45)).toBe("26-45");
  });

  it("maps 46 to 46-65", () => {
    expect(scoreToBucket(46)).toBe("46-65");
  });

  it("maps 65 to 46-65", () => {
    expect(scoreToBucket(65)).toBe("46-65");
  });

  it("maps 66 to 66-80", () => {
    expect(scoreToBucket(66)).toBe("66-80");
  });

  it("maps 80 to 66-80", () => {
    expect(scoreToBucket(80)).toBe("66-80");
  });

  it("maps 81 to 81-100", () => {
    expect(scoreToBucket(81)).toBe("81-100");
  });

  it("maps 100 to 81-100", () => {
    expect(scoreToBucket(100)).toBe("81-100");
  });
});

describe("telemetryPayloadSchema", () => {
  const validPayload = {
    scan_id: "550e8400-e29b-41d4-a716-446655440000",
    version: "0.1.0",
    platform: "darwin",
    language: "typescript",
    score_bucket: "66-80" as const,
    duration_ms: 1234,
    pillar_count: 8,
    finding_count: 5,
  };

  it("accepts a valid payload", () => {
    const result = telemetryPayloadSchema.parse(validPayload);
    expect(result.scan_id).toBe(validPayload.scan_id);
    expect(result.score_bucket).toBe("66-80");
  });

  it("rejects missing required fields", () => {
    const incomplete = { ...validPayload };
    delete (incomplete as Record<string, unknown>)["scan_id"];
    expect(() => telemetryPayloadSchema.parse(incomplete)).toThrow();
  });

  it("rejects invalid UUID", () => {
    expect(() =>
      telemetryPayloadSchema.parse({ ...validPayload, scan_id: "not-a-uuid" }),
    ).toThrow();
  });

  it("rejects negative duration", () => {
    expect(() => telemetryPayloadSchema.parse({ ...validPayload, duration_ms: -1 })).toThrow();
  });

  it("rejects invalid score bucket", () => {
    expect(() => telemetryPayloadSchema.parse({ ...validPayload, score_bucket: "0-50" })).toThrow();
  });
});

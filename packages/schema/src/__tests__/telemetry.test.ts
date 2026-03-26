import { describe, it, expect } from "vitest";
import {
  ScoreBucket,
  scoreToBucket,
  RepoSizeBucket,
  fileCountToBucket,
  telemetryPayloadSchema,
} from "../telemetry.js";

describe("ScoreBucket", () => {
  it("accepts valid bucket values", () => {
    for (const bucket of ["0-20", "21-40", "41-60", "61-80", "81-100"]) {
      expect(ScoreBucket.parse(bucket)).toBe(bucket);
    }
  });

  it("rejects invalid bucket", () => {
    expect(() => ScoreBucket.parse("0-50")).toThrow();
  });
});

describe("scoreToBucket", () => {
  it("maps 0 to 0-20", () => expect(scoreToBucket(0)).toBe("0-20"));
  it("maps 20 to 0-20", () => expect(scoreToBucket(20)).toBe("0-20"));
  it("maps 21 to 21-40", () => expect(scoreToBucket(21)).toBe("21-40"));
  it("maps 40 to 21-40", () => expect(scoreToBucket(40)).toBe("21-40"));
  it("maps 41 to 41-60", () => expect(scoreToBucket(41)).toBe("41-60"));
  it("maps 60 to 41-60", () => expect(scoreToBucket(60)).toBe("41-60"));
  it("maps 61 to 61-80", () => expect(scoreToBucket(61)).toBe("61-80"));
  it("maps 80 to 61-80", () => expect(scoreToBucket(80)).toBe("61-80"));
  it("maps 81 to 81-100", () => expect(scoreToBucket(81)).toBe("81-100"));
  it("maps 100 to 81-100", () => expect(scoreToBucket(100)).toBe("81-100"));
});

describe("RepoSizeBucket", () => {
  it("accepts valid bucket values", () => {
    for (const bucket of ["small", "medium", "large", "xlarge"]) {
      expect(RepoSizeBucket.parse(bucket)).toBe(bucket);
    }
  });

  it("rejects invalid bucket", () => {
    expect(() => RepoSizeBucket.parse("tiny")).toThrow();
  });
});

describe("fileCountToBucket", () => {
  it("maps 0 to small", () => expect(fileCountToBucket(0)).toBe("small"));
  it("maps 50 to small", () => expect(fileCountToBucket(50)).toBe("small"));
  it("maps 51 to medium", () => expect(fileCountToBucket(51)).toBe("medium"));
  it("maps 500 to medium", () => expect(fileCountToBucket(500)).toBe("medium"));
  it("maps 501 to large", () => expect(fileCountToBucket(501)).toBe("large"));
  it("maps 5000 to large", () => expect(fileCountToBucket(5000)).toBe("large"));
  it("maps 5001 to xlarge", () => expect(fileCountToBucket(5001)).toBe("xlarge"));
});

describe("telemetryPayloadSchema", () => {
  const validPayload = {
    scan_id: "550e8400-e29b-41d4-a716-446655440000",
    version: "0.1.0",
    platform: "darwin",
    language: "typescript",
    framework: "react",
    repo_size_bucket: "medium" as const,
    timestamp: "2026-03-26",
    score_bucket: "61-80" as const,
    duration_ms: 1234,
    pillar_count: 8,
    finding_count: 5,
  };

  it("accepts a valid payload", () => {
    const result = telemetryPayloadSchema.parse(validPayload);
    expect(result.scan_id).toBe(validPayload.scan_id);
    expect(result.score_bucket).toBe("61-80");
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

  it("accepts optional fix_applied field", () => {
    const result = telemetryPayloadSchema.parse({ ...validPayload, fix_applied: true });
    expect(result.fix_applied).toBe(true);
  });
});

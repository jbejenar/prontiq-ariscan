import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { TelemetryPayload } from "@prontiq/ariscan-schema";

// Mock consent module before importing sender
vi.mock("../../telemetry/consent.js", () => ({
  getTelemetryConsent: vi.fn(),
}));

import { sendTelemetry } from "../../telemetry/sender.js";
import { getTelemetryConsent } from "../../telemetry/consent.js";

const mockPayload: TelemetryPayload = {
  scan_id: "00000000-0000-0000-0000-000000000001",
  version: "0.2.0",
  platform: "darwin",
  language: "typescript",
  framework: "react",
  repo_size_bucket: "medium",
  timestamp: "2026-03-26",
  score_bucket: "61-80",
  duration_ms: 1234,
  pillar_count: 8,
  finding_count: 5,
};

describe("sendTelemetry", () => {
  const originalEnv = process.env;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.resetAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  });

  it("does not call fetch when consent is false", () => {
    vi.mocked(getTelemetryConsent).mockReturnValue(false);
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = mockFetch;

    sendTelemetry(mockPayload);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("calls fetch when consent is true", () => {
    vi.mocked(getTelemetryConsent).mockReturnValue(true);
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = mockFetch;

    sendTelemetry(mockPayload);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("telemetry.prontiq.dev"),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mockPayload),
      }),
    );
  });

  it("uses custom endpoint from env var", () => {
    vi.mocked(getTelemetryConsent).mockReturnValue(true);
    process.env["ARISCAN_TELEMETRY_URL"] = "https://custom.example.com/v1";
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = mockFetch;

    sendTelemetry(mockPayload);

    expect(mockFetch).toHaveBeenCalledWith("https://custom.example.com/v1", expect.any(Object));
  });

  it("swallows fetch errors silently", async () => {
    vi.mocked(getTelemetryConsent).mockReturnValue(true);
    const mockFetch = vi.fn().mockRejectedValue(new Error("network error"));
    globalThis.fetch = mockFetch;

    // Should not throw
    expect(() => sendTelemetry(mockPayload)).not.toThrow();

    // Wait for the promise to settle
    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
  });
});

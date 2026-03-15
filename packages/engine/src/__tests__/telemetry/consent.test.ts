import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
}));

// Import after mocks are set up
const { getTelemetryConsent, setTelemetryConsent, readConsentFile } =
  await import("../../telemetry/consent.js");

describe("getTelemetryConsent", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.resetAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns false by default when no env var and no consent file", () => {
    delete process.env["ARISCAN_TELEMETRY"];
    vi.mocked(fsSync.readFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });
    expect(getTelemetryConsent()).toBe(false);
  });

  it("returns true when env var is 'true'", () => {
    process.env["ARISCAN_TELEMETRY"] = "true";
    expect(getTelemetryConsent()).toBe(true);
  });

  it("returns true when env var is '1'", () => {
    process.env["ARISCAN_TELEMETRY"] = "1";
    expect(getTelemetryConsent()).toBe(true);
  });

  it("returns false when env var is 'false'", () => {
    process.env["ARISCAN_TELEMETRY"] = "false";
    expect(getTelemetryConsent()).toBe(false);
  });

  it("returns false when env var is '0'", () => {
    process.env["ARISCAN_TELEMETRY"] = "0";
    expect(getTelemetryConsent()).toBe(false);
  });

  it("env var 'false' overrides consent file with enabled=true", () => {
    process.env["ARISCAN_TELEMETRY"] = "false";
    vi.mocked(fsSync.readFileSync).mockReturnValue(
      JSON.stringify({ enabled: true, consentedAt: "2026-01-01T00:00:00Z" }),
    );
    expect(getTelemetryConsent()).toBe(false);
  });

  it("reads consent file when no env var", () => {
    delete process.env["ARISCAN_TELEMETRY"];
    vi.mocked(fsSync.readFileSync).mockReturnValue(
      JSON.stringify({ enabled: true, consentedAt: "2026-01-01T00:00:00Z" }),
    );
    expect(getTelemetryConsent()).toBe(true);
  });

  it("returns false when consent file has enabled=false", () => {
    delete process.env["ARISCAN_TELEMETRY"];
    vi.mocked(fsSync.readFileSync).mockReturnValue(
      JSON.stringify({ enabled: false, consentedAt: "2026-01-01T00:00:00Z" }),
    );
    expect(getTelemetryConsent()).toBe(false);
  });
});

describe("setTelemetryConsent", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
  });

  it("writes consent file with enabled=true", async () => {
    await setTelemetryConsent(true);

    expect(fs.mkdir).toHaveBeenCalledWith(expect.stringContaining("ariscan"), { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining("telemetry.json"),
      expect.stringContaining('"enabled": true'),
      "utf-8",
    );
  });

  it("writes consent file with enabled=false", async () => {
    await setTelemetryConsent(false);

    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining("telemetry.json"),
      expect.stringContaining('"enabled": false'),
      "utf-8",
    );
  });

  it("includes consentedAt timestamp", async () => {
    await setTelemetryConsent(true);

    const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
    const written = JSON.parse((writeCall?.[1] as string) ?? "{}");
    expect(written.consentedAt).toBeDefined();
    expect(written.consentedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe("readConsentFile", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns null when consent file does not exist", async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));
    expect(await readConsentFile()).toBeNull();
  });

  it("returns parsed consent file", async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({ enabled: true, consentedAt: "2026-01-01T00:00:00Z" }),
    );
    const result = await readConsentFile();
    expect(result).toEqual({ enabled: true, consentedAt: "2026-01-01T00:00:00Z" });
  });
});

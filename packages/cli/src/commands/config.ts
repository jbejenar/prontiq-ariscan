import {
  getTelemetryConsent,
  setTelemetryConsent,
  readConsentFile,
  buildTelemetryPayload,
} from "@prontiq/ariscan-engine";
import type { ScanResult } from "@prontiq/ariscan-schema";

/**
 * Handle `ariscan --telemetry true/false` — set telemetry consent.
 */
export async function handleTelemetrySet(value: string): Promise<void> {
  const lower = value.toLowerCase().trim();
  if (lower !== "true" && lower !== "false") {
    process.stderr.write(`Error: telemetry value must be "true" or "false", got "${value}"\n`);
    process.exit(2);
  }

  const enabled = lower === "true";
  await setTelemetryConsent(enabled);
  process.stderr.write(`Telemetry ${enabled ? "enabled" : "disabled"}.\n`);

  if (enabled) {
    process.stderr.write(
      "Thank you! Anonymous usage data helps improve ARI scoring.\n" +
        "Run with --telemetry-show to see exactly what is sent.\n",
    );
  }
}

/**
 * Handle `ariscan --telemetry-show` — show what telemetry data would be sent.
 */
export async function handleTelemetryShow(): Promise<void> {
  const consent = await readConsentFile();
  const envVal = process.env["ARISCAN_TELEMETRY"];
  const effective = getTelemetryConsent();

  process.stdout.write("=== Telemetry Status ===\n\n");
  process.stdout.write(
    `Consent file: ${consent ? `enabled=${consent.enabled}, consentedAt=${consent.consentedAt}` : "not found (default: disabled)"}\n`,
  );

  if (envVal !== undefined) {
    process.stdout.write(`ARISCAN_TELEMETRY env var: "${envVal}" (overrides consent file)\n`);
  }

  process.stdout.write(`Effective: ${effective ? "ENABLED" : "DISABLED"}\n\n`);

  // Show example payload
  const exampleResult: ScanResult = {
    metadata: {
      version: "0.1.0",
      timestamp: new Date().toISOString(),
      duration: 1234,
      repoPath: "/redacted",
      rubricVersion: "v1",
    },
    score: 72,
    level: "L4",
    levelMeta: {
      level: "L4",
      name: "Productive",
      description: "Ready for productive AI-assisted development",
    },
    securityGateTriggered: false,
    pillars: [],
    findings: [],
    detection: {
      languages: [{ language: "typescript", confidence: 0.9, primary: true }],
      frameworks: [],
      monorepo: null,
    },
  };

  const examplePayload = buildTelemetryPayload(exampleResult, 1234);
  process.stdout.write("Example payload (what would be sent):\n");
  process.stdout.write(JSON.stringify(examplePayload, null, 2) + "\n\n");
  process.stdout.write("Fields:\n");
  process.stdout.write("  scan_id       — random UUID (not persisted, not linkable)\n");
  process.stdout.write("  version       — CLI version\n");
  process.stdout.write("  platform      — OS platform (darwin/linux/win32)\n");
  process.stdout.write("  language      — primary detected language\n");
  process.stdout.write("  score_bucket  — bucketed score range (never raw score)\n");
  process.stdout.write("  duration_ms   — scan duration\n");
  process.stdout.write("  pillar_count  — number of pillars analyzed\n");
  process.stdout.write("  finding_count — total findings\n\n");
  process.stdout.write("No PII, repo names, file paths, or raw scores are ever transmitted.\n");
  process.stdout.write("See TELEMETRY.md for full details.\n");
}

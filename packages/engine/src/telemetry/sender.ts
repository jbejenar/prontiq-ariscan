import type { TelemetryPayload } from "@prontiq/ariscan-schema";
import { getTelemetryConsent } from "./consent.js";

const DEFAULT_ENDPOINT = "https://telemetry.prontiq.dev/v1/ari";
const TIMEOUT_MS = 2000;

/**
 * Fire-and-forget telemetry send.
 *
 * - No-op if consent is false.
 * - 2s timeout — never blocks or slows the scan.
 * - All errors are silently swallowed.
 */
export function sendTelemetry(payload: TelemetryPayload): void {
  if (!getTelemetryConsent()) return;

  const endpoint = process.env["ARISCAN_TELEMETRY_URL"] ?? DEFAULT_ENDPOINT;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: controller.signal,
  })
    .catch(() => {
      /* silently swallow — telemetry must never affect scan */
    })
    .finally(() => clearTimeout(timer));
}

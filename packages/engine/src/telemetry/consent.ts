import { readFileSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

/** Shape of the consent file stored at ~/.config/ariscan/telemetry.json */
interface ConsentFile {
  enabled: boolean;
  consentedAt: string;
}

/** Resolve the config directory, respecting XDG_CONFIG_HOME. */
function getConfigDir(): string {
  const xdg = process.env["XDG_CONFIG_HOME"];
  return xdg ? join(xdg, "ariscan") : join(homedir(), ".config", "ariscan");
}

function getConsentPath(): string {
  return join(getConfigDir(), "telemetry.json");
}

/**
 * Check whether the user has opted into telemetry.
 *
 * Priority:
 * 1. `ARISCAN_TELEMETRY` env var ("false" or "0" → disabled, "true" or "1" → enabled)
 * 2. Consent file at ~/.config/ariscan/telemetry.json
 * 3. Default: false (opt-in only)
 */
export function getTelemetryConsent(): boolean {
  const envVal = process.env["ARISCAN_TELEMETRY"];
  if (envVal !== undefined) {
    const lower = envVal.toLowerCase().trim();
    if (lower === "false" || lower === "0") return false;
    if (lower === "true" || lower === "1") return true;
  }

  try {
    const raw = readFileSync(getConsentPath(), "utf-8");
    const parsed = JSON.parse(raw) as ConsentFile;
    return parsed.enabled === true;
  } catch {
    return false;
  }
}

/**
 * Persist telemetry consent preference.
 * Creates the config directory if needed.
 */
export async function setTelemetryConsent(value: boolean): Promise<void> {
  const dir = getConfigDir();
  await mkdir(dir, { recursive: true });

  const consent: ConsentFile = {
    enabled: value,
    consentedAt: new Date().toISOString(),
  };

  await writeFile(getConsentPath(), JSON.stringify(consent, null, 2) + "\n", "utf-8");
}

/**
 * Read the current consent file for display purposes.
 * Returns null if no consent file exists.
 */
export async function readConsentFile(): Promise<ConsentFile | null> {
  try {
    const raw = await readFile(getConsentPath(), "utf-8");
    return JSON.parse(raw) as ConsentFile;
  } catch {
    return null;
  }
}

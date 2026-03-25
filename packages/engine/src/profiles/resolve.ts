/**
 * Language profile resolution (P3.06).
 *
 * Resolves the appropriate language profile from detection results or manual override.
 */
import type { DetectionResult, SupportedLanguage } from "@prontiq/ariscan-schema";
import { SupportedLanguage as SupportedLanguageSchema } from "@prontiq/ariscan-schema";
import { LANGUAGE_PROFILES } from "./language-profiles.js";
import type { LanguageProfileDef } from "./language-profiles.js";

/** Minimum detection confidence to auto-select a language profile. */
const MIN_CONFIDENCE = 0.3;

/**
 * Map from detected language names (as returned by P1.02 detection) to
 * SupportedLanguage values. Detection returns capitalized names like
 * "TypeScript", "Python", etc.
 */
const DETECTION_NAME_MAP: Record<string, SupportedLanguage> = {
  TypeScript: "typescript",
  JavaScript: "javascript",
  Python: "python",
  Go: "go",
  Rust: "rust",
  Java: "java",
  "C#": "csharp",
  Ruby: "ruby",
};

/**
 * Resolve the language profile to apply.
 *
 * @param detection — detection results from P1.02
 * @param override — manual language override from CLI flag or config
 * @returns The resolved profile, or undefined if no profile should be applied
 */
export function resolveLanguageProfile(
  detection: DetectionResult,
  override?: SupportedLanguage,
): LanguageProfileDef | undefined {
  // Manual override takes precedence
  if (override) {
    const parsed = SupportedLanguageSchema.safeParse(override);
    if (parsed.success) {
      return LANGUAGE_PROFILES[parsed.data];
    }
    return undefined;
  }

  // Auto-select from primary detected language
  const primary = detection.languages.find((lang) => lang.primary);
  if (!primary) return undefined;

  // Must meet minimum confidence threshold
  if (primary.confidence < MIN_CONFIDENCE) return undefined;

  const mapped = DETECTION_NAME_MAP[primary.language];
  if (!mapped) return undefined;

  return LANGUAGE_PROFILES[mapped];
}

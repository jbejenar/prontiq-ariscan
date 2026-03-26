/**
 * Language rubric profiles (P3.06).
 *
 * Each profile defines adjusted pillar weights for a specific language ecosystem.
 * Weights must sum to exactly 1.0. Profiles are auto-selected based on P1.02
 * language detection or manually via --language CLI flag / ariscan.yml.
 */
import type { PillarId, SupportedLanguage } from "@prontiq/ariscan-schema";

export interface LanguageProfileDef {
  /** Language this profile applies to. */
  language: SupportedLanguage;
  /** Human-readable name for display. */
  displayName: string;
  /** Adjusted pillar weights. Must sum to 1.0. */
  weights: Record<PillarId, number>;
  /** Why each weight differs (or matches) the default. */
  rationale: Record<PillarId, string>;
  /**
   * Score calibration offset to normalize cross-language comparability.
   * Applied after composite scoring: calibratedScore = clamp(raw + offset, 0, 100).
   * Compensates for systematic ecosystem bias in the rubric (calibrated on TypeScript).
   * Derived from benchmark data: ~40% of the gap between each language's mean and TS mean.
   */
  calibrationOffset: number;
}

/**
 * All language profile definitions.
 * Key = SupportedLanguage value, value = profile definition.
 */
export const LANGUAGE_PROFILES: Record<string, LanguageProfileDef> = {
  typescript: {
    language: "typescript",
    displayName: "TypeScript",
    weights: {
      P1: 0.15,
      P2: 0.15,
      P3: 0.18,
      P4: 0.1,
      P5: 0.1,
      P6: 0.15,
      P7: 0.12,
      P8: 0.05,
    },
    rationale: {
      P1: "Default: TypeScript is the calibration language",
      P2: "Default: standard feedback loop expectations",
      P3: "Default: standard test isolation expectations",
      P4: "Default: standard dev environment expectations",
      P5: "Default: standard doc readability expectations",
      P6: "Default: TypeScript strict mode is the calibration baseline",
      P7: "Default: standard navigability expectations",
      P8: "Default: standard security expectations",
    },
    calibrationOffset: 0,
  },

  javascript: {
    language: "javascript",
    displayName: "JavaScript",
    weights: {
      P1: 0.15,
      P2: 0.15,
      P3: 0.18,
      P4: 0.1,
      P5: 0.1,
      P6: 0.12,
      P7: 0.12,
      P8: 0.08,
    },
    rationale: {
      P1: "Default: context quality equally important",
      P2: "Default: feedback loop equally important",
      P3: "Default: test isolation equally important",
      P4: "Default: dev environment equally important",
      P5: "Default: doc readability equally important",
      P6: "Reduced: no native type system; JSDoc/ESLint partial coverage",
      P7: "Default: navigability equally important",
      P8: "Increased: dynamic typing increases security surface area",
    },
    calibrationOffset: 3,
  },

  python: {
    language: "python",
    displayName: "Python",
    weights: {
      P1: 0.15,
      P2: 0.15,
      P3: 0.18,
      P4: 0.12,
      P5: 0.1,
      P6: 0.13,
      P7: 0.12,
      P8: 0.05,
    },
    rationale: {
      P1: "Default: context quality equally important",
      P2: "Default: feedback loop equally important",
      P3: "Default: test isolation equally important",
      P4: "Increased: venv/poetry/uv management adds environment complexity",
      P5: "Default: doc readability equally important",
      P6: "Reduced: type hints optional; mypy/pyright are gradual typing tools",
      P7: "Default: navigability equally important",
      P8: "Default: standard security expectations",
    },
    calibrationOffset: 6,
  },

  go: {
    language: "go",
    displayName: "Go",
    weights: {
      P1: 0.15,
      P2: 0.15,
      P3: 0.18,
      P4: 0.08,
      P5: 0.1,
      P6: 0.1,
      P7: 0.14,
      P8: 0.1,
    },
    rationale: {
      P1: "Default: context quality equally important",
      P2: "Default: feedback loop equally important",
      P3: "Default: test isolation equally important",
      P4: "Reduced: Go toolchain is self-contained; minimal env setup needed",
      P5: "Default: doc readability equally important",
      P6: "Reduced: Go has inherent type safety and deterministic builds",
      P7: "Increased: Go's package system and explicit error handling reward navigability",
      P8: "Increased: Go is common in infrastructure; security is critical",
    },
    calibrationOffset: 6,
  },

  rust: {
    language: "rust",
    displayName: "Rust",
    weights: {
      P1: 0.15,
      P2: 0.15,
      P3: 0.18,
      P4: 0.08,
      P5: 0.1,
      P6: 0.08,
      P7: 0.16,
      P8: 0.1,
    },
    rationale: {
      P1: "Default: context quality equally important",
      P2: "Default: feedback loop equally important",
      P3: "Default: test isolation equally important",
      P4: "Reduced: Cargo provides comprehensive, self-contained tooling",
      P5: "Default: doc readability equally important",
      P6: "Reduced: strongest type system + ownership model; compiler enforces correctness",
      P7: "Increased: ownership model and module system reward structural clarity",
      P8: "Increased: Rust is used in security-critical infrastructure",
    },
    calibrationOffset: 7,
  },

  java: {
    language: "java",
    displayName: "Java",
    weights: {
      P1: 0.15,
      P2: 0.15,
      P3: 0.18,
      P4: 0.1,
      P5: 0.1,
      P6: 0.15,
      P7: 0.12,
      P8: 0.05,
    },
    rationale: {
      P1: "Default: context quality equally important",
      P2: "Default: feedback loop equally important",
      P3: "Default: test isolation equally important",
      P4: "Default: JDK + Maven/Gradle env management is standard complexity",
      P5: "Default: doc readability equally important",
      P6: "Default: Java has strong type system comparable to TypeScript strict",
      P7: "Default: navigability equally important",
      P8: "Default: standard security expectations",
    },
    calibrationOffset: 9,
  },

  csharp: {
    language: "csharp",
    displayName: "C#",
    weights: {
      P1: 0.15,
      P2: 0.15,
      P3: 0.18,
      P4: 0.1,
      P5: 0.1,
      P6: 0.15,
      P7: 0.12,
      P8: 0.05,
    },
    rationale: {
      P1: "Default: context quality equally important",
      P2: "Default: feedback loop equally important",
      P3: "Default: test isolation equally important",
      P4: "Default: .NET SDK management is standard complexity",
      P5: "Default: doc readability equally important",
      P6: "Default: C# has strong type system with nullable reference types",
      P7: "Default: navigability equally important",
      P8: "Default: standard security expectations",
    },
    calibrationOffset: 4,
  },

  ruby: {
    language: "ruby",
    displayName: "Ruby",
    weights: {
      P1: 0.15,
      P2: 0.15,
      P3: 0.18,
      P4: 0.12,
      P5: 0.1,
      P6: 0.12,
      P7: 0.12,
      P8: 0.06,
    },
    rationale: {
      P1: "Default: context quality equally important",
      P2: "Default: feedback loop equally important",
      P3: "Default: test isolation equally important",
      P4: "Increased: Ruby version management (rbenv/rvm) and Bundler add env complexity",
      P5: "Default: doc readability equally important",
      P6: "Reduced: dynamic typing; Sorbet/RBS are optional gradual typing",
      P7: "Default: navigability equally important",
      P8: "Slightly increased: dynamic typing increases attack surface",
    },
    calibrationOffset: 9,
  },
};

/** Get a language profile by language name. Returns undefined if not found. */
export function getLanguageProfile(language: string): LanguageProfileDef | undefined {
  return LANGUAGE_PROFILES[language];
}

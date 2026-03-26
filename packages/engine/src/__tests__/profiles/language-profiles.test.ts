import { describe, it, expect } from "vitest";
import {
  LANGUAGE_PROFILES,
  getLanguageProfile,
  resolveLanguageProfile,
} from "../../profiles/index.js";
import type { LanguageProfileDef } from "../../profiles/index.js";
import type { DetectionResult } from "@prontiq/ariscan-schema";

// Pre-resolve profiles to avoid undefined checks in every test
const GO = LANGUAGE_PROFILES["go"] as LanguageProfileDef;
const TS = LANGUAGE_PROFILES["typescript"] as LanguageProfileDef;
const RUST = LANGUAGE_PROFILES["rust"] as LanguageProfileDef;
const PYTHON = LANGUAGE_PROFILES["python"] as LanguageProfileDef;

function makeDetection(language: string, confidence: number, primary = true): DetectionResult {
  return {
    languages: [{ language, confidence, primary }],
    frameworks: [],
    monorepo: null,
    buildSystems: [],
  };
}

function emptyDetection(): DetectionResult {
  return { languages: [], frameworks: [], monorepo: null, buildSystems: [] };
}

describe("language profiles", () => {
  describe("weight validation", () => {
    it("all profiles have weights summing to 1.0", () => {
      for (const [name, profile] of Object.entries(LANGUAGE_PROFILES)) {
        const sum = Object.values(profile.weights).reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0, 3);
        // Verify all 8 pillars are present
        expect(Object.keys(profile.weights)).toHaveLength(8);
        // Verify name matches key
        expect(profile.language).toBe(name);
      }
    });

    it("all profiles have rationale for every pillar", () => {
      for (const [, profile] of Object.entries(LANGUAGE_PROFILES)) {
        expect(Object.keys(profile.rationale)).toHaveLength(8);
        for (const rationale of Object.values(profile.rationale)) {
          expect(rationale.length).toBeGreaterThan(0);
        }
      }
    });

    it("all profiles have a displayName", () => {
      for (const [, profile] of Object.entries(LANGUAGE_PROFILES)) {
        expect(profile.displayName.length).toBeGreaterThan(0);
      }
    });

    it("all profiles have a calibrationOffset that is a non-negative integer", () => {
      for (const [, profile] of Object.entries(LANGUAGE_PROFILES)) {
        expect(Number.isInteger(profile.calibrationOffset)).toBe(true);
        expect(profile.calibrationOffset).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("profile coverage", () => {
    it("defines profiles for all 6 required languages", () => {
      const required = ["typescript", "python", "go", "rust", "java", "csharp"];
      for (const lang of required) {
        expect(LANGUAGE_PROFILES[lang]).toBeDefined();
      }
    });

    it("also includes javascript and ruby profiles", () => {
      expect(LANGUAGE_PROFILES["javascript"]).toBeDefined();
      expect(LANGUAGE_PROFILES["ruby"]).toBeDefined();
    });
  });

  describe("weight differentiation", () => {
    it("Go has lower P6 weight than default TypeScript", () => {
      expect(GO.weights.P6).toBeLessThan(TS.weights.P6);
    });

    it("Go has higher P8 weight than default TypeScript", () => {
      expect(GO.weights.P8).toBeGreaterThan(TS.weights.P8);
    });

    it("Rust has lowest P6 weight", () => {
      for (const [name, profile] of Object.entries(LANGUAGE_PROFILES)) {
        if (name === "rust") continue;
        expect(RUST.weights.P6).toBeLessThanOrEqual(profile.weights.P6);
      }
    });

    it("Python has higher P4 weight than default", () => {
      expect(PYTHON.weights.P4).toBeGreaterThan(TS.weights.P4);
    });
  });

  describe("getLanguageProfile", () => {
    it("returns profile for valid language", () => {
      const profile = getLanguageProfile("go");
      expect(profile).toBeDefined();
      expect(profile?.language).toBe("go");
    });

    it("returns undefined for unknown language", () => {
      expect(getLanguageProfile("fortran")).toBeUndefined();
    });
  });

  describe("resolveLanguageProfile", () => {
    it("auto-selects from primary detected language", () => {
      const detection = makeDetection("TypeScript", 0.8);
      const profile = resolveLanguageProfile(detection);
      expect(profile?.language).toBe("typescript");
    });

    it("auto-selects Python profile", () => {
      const detection = makeDetection("Python", 0.7);
      const profile = resolveLanguageProfile(detection);
      expect(profile?.language).toBe("python");
    });

    it("auto-selects Go profile", () => {
      const detection = makeDetection("Go", 0.6);
      const profile = resolveLanguageProfile(detection);
      expect(profile?.language).toBe("go");
    });

    it("auto-selects C# profile", () => {
      const detection = makeDetection("C#", 0.5);
      const profile = resolveLanguageProfile(detection);
      expect(profile?.language).toBe("csharp");
    });

    it("returns undefined for low-confidence detection", () => {
      const detection = makeDetection("TypeScript", 0.2);
      const profile = resolveLanguageProfile(detection);
      expect(profile).toBeUndefined();
    });

    it("returns undefined when no primary language", () => {
      const detection: DetectionResult = {
        languages: [{ language: "TypeScript", confidence: 0.8, primary: false }],
        frameworks: [],
        monorepo: null,
        buildSystems: [],
      };
      const profile = resolveLanguageProfile(detection);
      expect(profile).toBeUndefined();
    });

    it("returns undefined for empty detection", () => {
      const profile = resolveLanguageProfile(emptyDetection());
      expect(profile).toBeUndefined();
    });

    it("returns undefined for unsupported detected language", () => {
      const detection = makeDetection("Haskell", 0.9);
      const profile = resolveLanguageProfile(detection);
      expect(profile).toBeUndefined();
    });

    it("manual override takes precedence over detection", () => {
      const detection = makeDetection("TypeScript", 0.9);
      const profile = resolveLanguageProfile(detection, "python");
      expect(profile?.language).toBe("python");
    });

    it("manual override works even with empty detection", () => {
      const profile = resolveLanguageProfile(emptyDetection(), "rust");
      expect(profile?.language).toBe("rust");
    });

    it("invalid manual override returns undefined", () => {
      const profile = resolveLanguageProfile(emptyDetection(), "fortran" as "typescript");
      expect(profile).toBeUndefined();
    });
  });
});

import type { DetectedLanguage } from "@prontiq/ariscan-schema";
import type { RepoContext } from "../analyzers/analyzer.interface.js";

interface LanguageSpec {
  name: string;
  extensions: string[];
  /** Marker files that strongly indicate the language is in use */
  markers: string[];
  /** Bonus confidence when a marker is found (added to extension-based confidence) */
  markerBoost: number;
}

const LANGUAGE_SPECS: LanguageSpec[] = [
  {
    name: "TypeScript",
    extensions: [".ts", ".tsx", ".mts", ".cts"],
    markers: ["tsconfig.json", "tsconfig.base.json"],
    markerBoost: 0.2,
  },
  {
    name: "JavaScript",
    extensions: [".js", ".jsx", ".mjs", ".cjs"],
    markers: ["jsconfig.json", ".babelrc", "babel.config.js", "babel.config.json"],
    markerBoost: 0.1,
  },
  {
    name: "Python",
    extensions: [".py", ".pyi"],
    markers: [
      "pyproject.toml",
      "setup.py",
      "setup.cfg",
      "Pipfile",
      "requirements.txt",
      "poetry.lock",
    ],
    markerBoost: 0.2,
  },
  {
    name: "Go",
    extensions: [".go"],
    markers: ["go.mod", "go.sum"],
    markerBoost: 0.2,
  },
  {
    name: "Rust",
    extensions: [".rs"],
    markers: ["Cargo.toml", "Cargo.lock"],
    markerBoost: 0.2,
  },
  {
    name: "Java",
    extensions: [".java"],
    markers: ["pom.xml", "build.gradle", "build.gradle.kts", "gradlew"],
    markerBoost: 0.2,
  },
  {
    name: "C#",
    extensions: [".cs"],
    markers: ["*.csproj", "*.sln", "Directory.Build.props"],
    markerBoost: 0.2,
  },
  {
    name: "Ruby",
    extensions: [".rb", ".rake"],
    markers: ["Gemfile", "Gemfile.lock", "Rakefile"],
    markerBoost: 0.2,
  },
  {
    name: "PHP",
    extensions: [".php"],
    markers: ["composer.json", "composer.lock"],
    markerBoost: 0.2,
  },
];

/**
 * Directory segments that indicate test/fixture/example paths.
 * Files in these directories are down-weighted when computing language ratios,
 * because they often reflect ecosystem tooling (e.g. JS test suites in a Rust
 * project) rather than the core implementation language.
 */
const TEST_DIR_SEGMENTS = new Set([
  "test",
  "tests",
  "__tests__",
  "spec",
  "specs",
  "fixtures",
  "fixture",
  "examples",
  "example",
  "benchmark",
  "benchmarks",
  "e2e",
  "testdata",
  "test-data",
  "testing",
]);

/** Weight applied to files in test-like directories (vs 1.0 for core files). */
const TEST_PATH_WEIGHT = 0.5;

/**
 * When more than this fraction of a language's files are in test/peripheral
 * directories, its confidence is penalised. This prevents languages that exist
 * almost entirely as test infrastructure from being detected as primary.
 */
const DOMINANCE_THRESHOLD = 0.7;

function isTestPath(filePath: string): boolean {
  const segments = filePath.split("/");
  // Check all directory segments (not the filename)
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (seg && TEST_DIR_SEGMENTS.has(seg.toLowerCase())) return true;
  }
  return false;
}

/** Non-source extensions to ignore when computing file ratios */
const IGNORED_EXTENSIONS = new Set([
  ".md",
  ".txt",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".xml",
  ".csv",
  ".lock",
  ".gitignore",
  ".env",
  ".svg",
  ".png",
  ".jpg",
  ".gif",
  ".ico",
  ".woff",
  ".woff2",
  ".eot",
  ".ttf",
  ".map",
  ".min.js",
  ".min.css",
  ".css",
  ".scss",
  ".less",
  ".html",
  ".hbs",
  ".ejs",
  ".liquid",
]);

function getExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf(".");
  if (lastDot === -1) return "";
  return filePath.slice(lastDot).toLowerCase();
}

/**
 * Detect programming languages in the repository.
 *
 * Confidence is based on the proportion of source files using the language
 * plus a boost if marker files are present.
 */
export async function detectLanguages(context: RepoContext): Promise<DetectedLanguage[]> {
  const { files } = context;

  // Count files per language with test-path down-weighting.
  // Also track raw core vs test counts for dominance penalty.
  const counts = new Map<string, number>();
  const rawCoreCount = new Map<string, number>();
  const rawTestCount = new Map<string, number>();
  let totalSourceFiles = 0;

  for (const file of files) {
    const ext = getExtension(file);
    if (!ext || IGNORED_EXTENSIONS.has(ext)) continue;

    for (const spec of LANGUAGE_SPECS) {
      if (spec.extensions.includes(ext)) {
        const isTest = isTestPath(file);
        const weight = isTest ? TEST_PATH_WEIGHT : 1;
        counts.set(spec.name, (counts.get(spec.name) ?? 0) + weight);
        totalSourceFiles += weight;
        if (isTest) {
          rawTestCount.set(spec.name, (rawTestCount.get(spec.name) ?? 0) + 1);
        } else {
          rawCoreCount.set(spec.name, (rawCoreCount.get(spec.name) ?? 0) + 1);
        }
        break; // Each file counts once
      }
    }
  }

  // Check markers and compute confidence
  const results: DetectedLanguage[] = [];
  let maxCount = 0;

  for (const spec of LANGUAGE_SPECS) {
    const count = counts.get(spec.name) ?? 0;
    if (count === 0) {
      // Still check markers — a repo might have config but no source yet
      let hasMarker = false;
      for (const marker of spec.markers) {
        if (!marker.includes("*")) {
          if (await context.fileExists(marker)) {
            hasMarker = true;
            break;
          }
        } else {
          // Glob-style markers: check if any file matches the pattern
          const pattern = marker.replaceAll("*", "");
          if (files.some((f) => f.endsWith(pattern))) {
            hasMarker = true;
            break;
          }
        }
      }
      if (hasMarker) {
        results.push({
          language: spec.name,
          confidence: Math.min(1, spec.markerBoost),
          primary: false,
        });
      }
      continue;
    }

    if (count > maxCount) maxCount = count;

    // Base confidence from file ratio (capped at 0.8 from files alone)
    let confidence = Math.min(0.8, count / totalSourceFiles);

    // Marker boost
    for (const marker of spec.markers) {
      if (!marker.includes("*")) {
        if (await context.fileExists(marker)) {
          confidence = Math.min(1, confidence + spec.markerBoost);
          break;
        }
      } else {
        const pattern = marker.replaceAll("*", "");
        if (files.some((f) => f.endsWith(pattern))) {
          confidence = Math.min(1, confidence + spec.markerBoost);
          break;
        }
      }
    }

    // Test-dominance penalty: if a language exists almost entirely in test/
    // peripheral directories, it is likely tooling infrastructure rather than
    // the primary implementation language. Penalise its confidence.
    const core = rawCoreCount.get(spec.name) ?? 0;
    const test = rawTestCount.get(spec.name) ?? 0;
    const rawTotal = core + test;
    if (rawTotal > 0) {
      const testRatio = test / rawTotal;
      if (testRatio > DOMINANCE_THRESHOLD) {
        const penalty = Math.max(0.5, 1 - (testRatio - DOMINANCE_THRESHOLD));
        confidence *= penalty;
      }
    }

    // Round to 2 decimal places
    confidence = Math.round(confidence * 100) / 100;

    results.push({
      language: spec.name,
      confidence,
      primary: false, // Will be set below
    });
  }

  // Sort by confidence descending, then mark primary
  results.sort((a, b) => b.confidence - a.confidence);
  const first = results[0];
  if (first) {
    first.primary = true;
  }

  return results;
}

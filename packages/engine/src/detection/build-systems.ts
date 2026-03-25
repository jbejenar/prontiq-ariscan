import type { BuildSystem } from "@prontiq/ariscan-schema";
import type { RepoContext } from "../analyzers/analyzer.interface.js";

interface BuildSystemProbe {
  system: BuildSystem;
  /** Files whose presence indicates this build system. */
  files: string[];
  /** Optional: require file content to match a pattern (for disambiguation). */
  contentCheck?: { file: string; pattern: RegExp };
}

const PROBES: BuildSystemProbe[] = [
  { system: "pnpm", files: ["pnpm-lock.yaml"] },
  { system: "yarn", files: ["yarn.lock"] },
  { system: "npm", files: ["package-lock.json"] },
  { system: "make", files: ["Makefile", "GNUmakefile", "makefile"] },
  {
    system: "docker-compose",
    files: ["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"],
  },
  {
    system: "poetry",
    files: ["pyproject.toml"],
    contentCheck: { file: "pyproject.toml", pattern: /\[tool\.poetry\]/ },
  },
  { system: "cargo", files: ["Cargo.toml"] },
  { system: "go", files: ["go.mod"] },
  { system: "maven", files: ["pom.xml"] },
  { system: "gradle", files: ["build.gradle", "build.gradle.kts"] },
];

/**
 * Detect build systems present in the repository.
 * Returns an array of detected build system identifiers.
 */
export async function detectBuildSystems(context: RepoContext): Promise<BuildSystem[]> {
  const detected: BuildSystem[] = [];

  for (const probe of PROBES) {
    let found = false;
    for (const file of probe.files) {
      if (await context.fileExists(file)) {
        found = true;
        break;
      }
    }

    // If a content check is required, always validate it regardless of which file was found
    if (found && probe.contentCheck) {
      const content = await context.readFile(probe.contentCheck.file);
      if (!content || !probe.contentCheck.pattern.test(content)) {
        found = false;
      }
    }

    if (found) {
      detected.push(probe.system);
    }
  }

  return detected;
}

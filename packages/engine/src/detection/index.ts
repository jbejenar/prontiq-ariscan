import type { DetectionResult } from "@prontiq/ariscan-schema";
import type { RepoContext } from "../analyzers/analyzer.interface.js";
import { detectLanguages } from "./languages.js";
import { detectFrameworks } from "./frameworks.js";
import { detectMonorepo } from "./monorepo.js";
import { detectBuildSystems } from "./build-systems.js";

export { detectLanguages } from "./languages.js";
export { detectFrameworks } from "./frameworks.js";
export { detectMonorepo } from "./monorepo.js";
export { detectBuildSystems } from "./build-systems.js";
export { classifyProfile } from "./profile.js";

/**
 * Run all detection modules and return a combined result.
 */
export async function detect(context: RepoContext): Promise<DetectionResult> {
  const [languages, frameworks, monorepo, buildSystems] = await Promise.all([
    detectLanguages(context),
    detectFrameworks(context),
    detectMonorepo(context),
    detectBuildSystems(context),
  ]);

  return { languages, frameworks, monorepo, buildSystems };
}

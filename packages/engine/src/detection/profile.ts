import type { Archetype, Confidence, RepoProfile, DetectionResult } from "@prontiq/ariscan-schema";
import type { RepoContext } from "../analyzers/analyzer.interface.js";

/** Source file extensions matching the navigability analyzer's pattern. */
const SOURCE_FILE_PATTERN = /\.[jt]sx?$|\.py$|\.go$|\.java$|\.cs$|\.rb$|\.rs$/;

/** Files that indicate CI is configured. */
const CI_PATHS = [
  ".github/workflows",
  ".gitlab-ci.yml",
  ".circleci/config.yml",
  "Jenkinsfile",
  ".travis.yml",
  "azure-pipelines.yml",
  "bitbucket-pipelines.yml",
] as const;

/** Files that indicate team-scale development. */
const TEAM_SIGNAL_PATHS = [
  "CODEOWNERS",
  ".github/CODEOWNERS",
  "docs/CODEOWNERS",
  ".github/pull_request_template.md",
  ".github/PULL_REQUEST_TEMPLATE.md",
  "CONTRIBUTING.md",
] as const;

/** Package manager files indicating a library with published exports. */
interface LibrarySignal {
  file: string;
  /** JSON path or content pattern to check. */
  check: (content: string) => boolean;
}

const LIBRARY_SIGNALS: LibrarySignal[] = [
  {
    file: "package.json",
    check: (c) => {
      try {
        const pkg: Record<string, unknown> = JSON.parse(c);
        return Boolean(pkg["main"] || pkg["exports"] || pkg["types"] || pkg["typings"]);
      } catch {
        return false;
      }
    },
  },
  {
    file: "pyproject.toml",
    check: (c) => /\[project\]/.test(c) || /\[tool\.poetry\]/.test(c),
  },
  {
    file: "Cargo.toml",
    check: (c) => /\[lib\]/.test(c),
  },
  {
    file: "setup.py",
    check: () => true,
  },
];

/** Frameworks that indicate an API service. */
const API_FRAMEWORKS = new Set([
  "Express",
  "Fastify",
  "Koa",
  "NestJS",
  "FastAPI",
  "Django",
  "Flask",
  "Spring Boot",
  "Rails",
  "Gin",
  "Echo",
  "Fiber",
  "Actix",
  "Rocket",
  "ASP.NET",
  "Hono",
]);

/** Dependencies indicating a CLI tool. */
const CLI_DEPS = new Set([
  "commander",
  "yargs",
  "citty",
  "oclif",
  "inquirer",
  "meow",
  "cac",
  "clipanion",
]);

/**
 * Classify a repository into an archetype based on detection signals.
 * Uses existing detection results (languages, frameworks, monorepo) plus
 * additional file-level signals.
 */
export async function classifyProfile(
  context: RepoContext,
  detection: DetectionResult,
): Promise<RepoProfile> {
  const signals: string[] = [];

  // Count files
  const fileCount = context.files.length;
  const sourceFiles = context.files.filter(
    (f) =>
      SOURCE_FILE_PATTERN.test(f) &&
      !f.includes("node_modules") &&
      !f.includes("dist/") &&
      !f.includes("build/"),
  );
  const sourceFileCount = sourceFiles.length;

  // Check CI
  const hasCI = await detectCI(context);
  if (hasCI) signals.push("ci-detected");

  // Check team signals
  const hasTeamSignals = await detectTeamSignals(context);
  if (hasTeamSignals) signals.push("team-signals");

  // Check monorepo
  const isMonorepo = detection.monorepo !== null;
  if (isMonorepo) signals.push(`monorepo:${detection.monorepo?.tool}`);

  // Check for library pattern
  const isLibrary = await detectLibrary(context);
  if (isLibrary) signals.push("library-exports");

  // Check for API service pattern
  const isApiService = detection.frameworks.some((f) => API_FRAMEWORKS.has(f.framework));
  if (isApiService) {
    const apiFramework = detection.frameworks.find((f) => API_FRAMEWORKS.has(f.framework));
    signals.push(`api-framework:${apiFramework?.framework}`);
  }

  // Check for Dockerfile with EXPOSE
  const hasDockerExpose = await detectDockerExpose(context);
  if (hasDockerExpose) signals.push("docker-expose");

  // Check for CLI tool pattern
  const isCli = await detectCli(context);
  if (isCli) signals.push("cli-tool");

  signals.push(`files:${fileCount}`, `source-files:${sourceFileCount}`);

  // Classification logic — ordered from most specific to least
  const { archetype, confidence } = classify(
    sourceFileCount,
    hasCI,
    isMonorepo,
    hasTeamSignals,
    isLibrary,
    isApiService || hasDockerExpose,
    isCli,
  );

  return {
    archetype,
    confidence,
    signals,
    fileCount,
    sourceFileCount,
    hasCI,
  };
}

function classify(
  sourceFileCount: number,
  hasCI: boolean,
  isMonorepo: boolean,
  hasTeamSignals: boolean,
  isLibrary: boolean,
  isApiService: boolean,
  isCli: boolean,
): { archetype: Archetype; confidence: Confidence } {
  // monorepo-enterprise: monorepo tool detected or >200 source files with CI
  if (isMonorepo) {
    return { archetype: "monorepo-enterprise", confidence: "high" };
  }
  if (sourceFileCount > 200 && hasCI && hasTeamSignals) {
    return { archetype: "monorepo-enterprise", confidence: "medium" };
  }

  // cli-tool: bin field or CLI dependency
  if (isCli) {
    return { archetype: "cli-tool", confidence: "high" };
  }

  // api-service: API framework detected or Docker with EXPOSE
  if (isApiService) {
    return { archetype: "api-service", confidence: "high" };
  }

  // library: published exports detected (size does not disqualify — monorepo check above takes precedence for large repos)
  if (isLibrary) {
    const confidence = sourceFileCount <= 200 ? "high" : "medium";
    return { archetype: "library", confidence };
  }

  // small-team: 10-50 source files, may have CI
  if (sourceFileCount >= 10 && sourceFileCount <= 50) {
    return { archetype: "small-team", confidence: hasCI ? "high" : "medium" };
  }

  // Large non-monorepo with CI but no other specific signals
  if (sourceFileCount > 50 && hasCI) {
    return { archetype: "small-team", confidence: "low" };
  }

  // solo-hobby: <10 source files, no CI, no monorepo, no team signals
  if (sourceFileCount < 10 && !hasCI && !hasTeamSignals) {
    return { archetype: "solo-hobby", confidence: "high" };
  }

  // Default fallback: small-team with low confidence
  return { archetype: "small-team", confidence: "low" };
}

async function detectCI(context: RepoContext): Promise<boolean> {
  for (const p of CI_PATHS) {
    // For directory-based CI (e.g. .github/workflows), check for any files under it
    if (p === ".github/workflows") {
      if (context.files.some((f) => f.startsWith(".github/workflows/"))) return true;
    } else {
      if (await context.fileExists(p)) return true;
    }
  }
  return false;
}

async function detectTeamSignals(context: RepoContext): Promise<boolean> {
  for (const p of TEAM_SIGNAL_PATHS) {
    if (await context.fileExists(p)) return true;
  }
  return false;
}

async function detectLibrary(context: RepoContext): Promise<boolean> {
  for (const sig of LIBRARY_SIGNALS) {
    if (await context.fileExists(sig.file)) {
      const content = await context.readFile(sig.file);
      if (content && sig.check(content)) return true;
    }
  }
  return false;
}

async function detectDockerExpose(context: RepoContext): Promise<boolean> {
  if (await context.fileExists("Dockerfile")) {
    const content = await context.readFile("Dockerfile");
    if (content && /^EXPOSE\s+/m.test(content)) return true;
  }
  return false;
}

async function detectCli(context: RepoContext): Promise<boolean> {
  if (await context.fileExists("package.json")) {
    const content = await context.readFile("package.json");
    if (content) {
      try {
        const pkg: Record<string, unknown> = JSON.parse(content);
        if (pkg["bin"]) return true;
        // Check CLI dependencies
        const allDeps = {
          ...(typeof pkg["dependencies"] === "object" && pkg["dependencies"] !== null
            ? (pkg["dependencies"] as Record<string, string>)
            : {}),
          ...(typeof pkg["devDependencies"] === "object" && pkg["devDependencies"] !== null
            ? (pkg["devDependencies"] as Record<string, string>)
            : {}),
        };
        for (const dep of Object.keys(allDeps)) {
          if (CLI_DEPS.has(dep)) return true;
        }
      } catch {
        // ignore parse error
      }
    }
  }
  // Rust CLI: check for [[bin]] in Cargo.toml
  if (await context.fileExists("Cargo.toml")) {
    const content = await context.readFile("Cargo.toml");
    if (content && /\[\[bin\]\]/.test(content)) return true;
  }
  // Python CLI: check for [project.scripts] in pyproject.toml
  if (await context.fileExists("pyproject.toml")) {
    const content = await context.readFile("pyproject.toml");
    if (content && /\[project\.scripts\]/.test(content)) return true;
  }
  // Go CLI: check for clap/cobra dependency
  if (await context.fileExists("go.mod")) {
    const content = await context.readFile("go.mod");
    if (content && /cobra|urfave\/cli/.test(content)) return true;
  }
  return false;
}

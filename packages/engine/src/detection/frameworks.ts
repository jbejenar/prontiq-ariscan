import type { DetectedFramework } from "@prontiq/schema";
import type { RepoContext } from "../analyzers/analyzer.interface.js";

interface FrameworkSpec {
  name: string;
  /** Config files whose presence strongly indicates the framework */
  configFiles: string[];
  /** package.json dependency names to check */
  dependencies: string[];
  /** Confidence when found via config file */
  configConfidence: number;
  /** Confidence when found only via dependency */
  depConfidence: number;
}

const FRAMEWORK_SPECS: FrameworkSpec[] = [
  // Order matters: more specific frameworks first (Next.js before React, Nuxt before Vue)
  {
    name: "Next.js",
    configFiles: ["next.config.js", "next.config.mjs", "next.config.ts"],
    dependencies: ["next"],
    configConfidence: 0.95,
    depConfidence: 0.9,
  },
  {
    name: "Nuxt",
    configFiles: ["nuxt.config.ts", "nuxt.config.js"],
    dependencies: ["nuxt"],
    configConfidence: 0.95,
    depConfidence: 0.9,
  },
  {
    name: "Angular",
    configFiles: ["angular.json", ".angular-cli.json"],
    dependencies: ["@angular/core"],
    configConfidence: 0.95,
    depConfidence: 0.9,
  },
  {
    name: "Svelte",
    configFiles: ["svelte.config.js", "svelte.config.ts"],
    dependencies: ["svelte"],
    configConfidence: 0.9,
    depConfidence: 0.8,
  },
  {
    name: "Astro",
    configFiles: ["astro.config.mjs", "astro.config.ts", "astro.config.js"],
    dependencies: ["astro"],
    configConfidence: 0.95,
    depConfidence: 0.9,
  },
  {
    name: "React",
    configFiles: [],
    dependencies: ["react", "react-dom"],
    configConfidence: 0,
    depConfidence: 0.85,
  },
  {
    name: "Vue",
    configFiles: ["vue.config.js"],
    dependencies: ["vue"],
    configConfidence: 0.9,
    depConfidence: 0.85,
  },
  {
    name: "Express",
    configFiles: [],
    dependencies: ["express"],
    configConfidence: 0,
    depConfidence: 0.8,
  },
  {
    name: "FastAPI",
    configFiles: [],
    dependencies: ["fastapi"],
    configConfidence: 0,
    depConfidence: 0.8,
  },
  {
    name: "Django",
    configFiles: ["manage.py"],
    dependencies: ["django"],
    configConfidence: 0.85,
    depConfidence: 0.8,
  },
  {
    name: "Flask",
    configFiles: [],
    dependencies: ["flask"],
    configConfidence: 0,
    depConfidence: 0.8,
  },
  {
    name: "Spring Boot",
    configFiles: [],
    dependencies: ["spring-boot-starter"],
    configConfidence: 0,
    depConfidence: 0.85,
  },
  {
    name: ".NET",
    configFiles: [],
    dependencies: ["Microsoft.AspNetCore"],
    configConfidence: 0,
    depConfidence: 0.85,
  },
  {
    name: "Rails",
    configFiles: ["config/routes.rb", "bin/rails"],
    dependencies: ["rails"],
    configConfidence: 0.9,
    depConfidence: 0.85,
  },
];

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Extract all dependency names from a package.json structure.
 */
function extractNpmDeps(pkg: PackageJson): Set<string> {
  const deps = new Set<string>();
  if (pkg.dependencies) {
    for (const name of Object.keys(pkg.dependencies)) {
      deps.add(name);
    }
  }
  if (pkg.devDependencies) {
    for (const name of Object.keys(pkg.devDependencies)) {
      deps.add(name);
    }
  }
  return deps;
}

/**
 * Check Python dependencies from requirements.txt or pyproject.toml.
 */
async function extractPythonDeps(context: RepoContext): Promise<Set<string>> {
  const deps = new Set<string>();

  const requirements = await context.readFile("requirements.txt");
  if (requirements) {
    for (const line of requirements.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      // Extract package name (before any version specifier)
      const match = trimmed.match(/^([a-zA-Z0-9_-]+)/);
      if (match?.[1]) deps.add(match[1].toLowerCase());
    }
  }

  const pyproject = await context.readFile("pyproject.toml");
  if (pyproject) {
    // Simple heuristic: look for dependency names in [project.dependencies] or [tool.poetry.dependencies]
    for (const line of pyproject.split("\n")) {
      const trimmed = line.trim();
      // Match patterns like: fastapi = "^0.100" or "fastapi>=0.100"
      const tomlMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\s*=/);
      if (tomlMatch?.[1]) deps.add(tomlMatch[1].toLowerCase());
      // Also match quoted deps in arrays: "fastapi>=0.100"
      const arrayMatch = trimmed.match(/^"([a-zA-Z0-9_-]+)/);
      if (arrayMatch?.[1]) deps.add(arrayMatch[1].toLowerCase());
    }
  }

  return deps;
}

/**
 * Check Ruby dependencies from Gemfile.
 */
async function extractRubyDeps(context: RepoContext): Promise<Set<string>> {
  const deps = new Set<string>();

  const gemfile = await context.readFile("Gemfile");
  if (gemfile) {
    for (const line of gemfile.split("\n")) {
      const match = line.match(/gem\s+['"]([^'"]+)['"]/);
      if (match?.[1]) deps.add(match[1].toLowerCase());
    }
  }

  return deps;
}

/**
 * Check Java/Gradle dependencies (simple heuristic).
 */
async function extractJavaDeps(context: RepoContext): Promise<Set<string>> {
  const deps = new Set<string>();

  const pomXml = await context.readFile("pom.xml");
  if (pomXml) {
    // Simple: look for artifactId tags
    const matches = pomXml.matchAll(/<artifactId>([^<]+)<\/artifactId>/g);
    for (const match of matches) {
      if (match[1]) deps.add(match[1]);
    }
  }

  const buildGradle = await context.readFile("build.gradle");
  if (buildGradle) {
    // Look for group:artifact patterns
    const matches = buildGradle.matchAll(
      /['"]([a-zA-Z0-9._-]+:[a-zA-Z0-9._-]+)/g,
    );
    for (const match of matches) {
      if (match[1]) deps.add(match[1]);
    }
  }

  return deps;
}

/**
 * Check .NET dependencies from .csproj files.
 */
async function extractDotNetDeps(context: RepoContext): Promise<Set<string>> {
  const deps = new Set<string>();

  const csprojFiles = context.files.filter((f) => f.endsWith(".csproj"));
  for (const csproj of csprojFiles.slice(0, 5)) {
    // Limit to avoid slowness
    const content = await context.readFile(csproj);
    if (content) {
      const matches = content.matchAll(
        /Include="([^"]+)"/g,
      );
      for (const match of matches) {
        if (match[1]) deps.add(match[1]);
      }
    }
  }

  return deps;
}

/**
 * Detect frameworks used in the repository.
 */
export async function detectFrameworks(
  context: RepoContext,
): Promise<DetectedFramework[]> {
  // Gather all dependency sources
  const pkg = await context.readJson<PackageJson>("package.json");
  const npmDeps = pkg ? extractNpmDeps(pkg) : new Set<string>();
  const pythonDeps = await extractPythonDeps(context);
  const rubyDeps = await extractRubyDeps(context);
  const javaDeps = await extractJavaDeps(context);
  const dotnetDeps = await extractDotNetDeps(context);

  const allDeps = new Set([
    ...npmDeps,
    ...pythonDeps,
    ...rubyDeps,
    ...javaDeps,
    ...dotnetDeps,
  ]);

  const results: DetectedFramework[] = [];

  for (const spec of FRAMEWORK_SPECS) {
    let confidence = 0;

    // Check config files
    for (const configFile of spec.configFiles) {
      if (await context.fileExists(configFile)) {
        confidence = Math.max(confidence, spec.configConfidence);
        break;
      }
    }

    // Check dependencies
    for (const dep of spec.dependencies) {
      if (allDeps.has(dep)) {
        confidence = Math.max(confidence, spec.depConfidence);
        break;
      }
    }

    if (confidence > 0) {
      results.push({
        framework: spec.name,
        confidence: Math.round(confidence * 100) / 100,
      });
    }
  }

  // Sort by confidence descending
  results.sort((a, b) => b.confidence - a.confidence);

  return results;
}

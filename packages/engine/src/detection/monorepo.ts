import type { DetectedMonorepo } from "@prontiq/ariscan-schema";
import type { RepoContext } from "../analyzers/analyzer.interface.js";

interface MonorepoSpec {
  tool: string;
  /** Config file that identifies the monorepo tool */
  configFile: string;
  /** Extract workspace package paths from the config */
  extractPackages: (content: string, context: RepoContext) => Promise<string[]>;
}

/**
 * Parse a pnpm-workspace.yaml file to extract package globs and resolve them.
 */
async function parsePnpmWorkspace(content: string, context: RepoContext): Promise<string[]> {
  // Simple YAML parsing for the packages field
  const packages: string[] = [];
  let inPackages = false;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "packages:") {
      inPackages = true;
      continue;
    }
    if (inPackages) {
      if (trimmed.startsWith("- ")) {
        const glob = trimmed.slice(2).replace(/['"]/g, "").trim();
        // Resolve glob to actual directories
        const resolved = resolveWorkspaceGlob(glob, context.files);
        packages.push(...resolved);
      } else if (trimmed && !trimmed.startsWith("#")) {
        // Non-list item means we've left the packages section
        break;
      }
    }
  }

  return packages;
}

/**
 * Resolve a workspace glob pattern (e.g. "packages/*") to actual directories.
 */
function resolveWorkspaceGlob(glob: string, files: readonly string[]): string[] {
  const dirs = new Set<string>();

  if (glob.endsWith("/*") || glob.endsWith("/**")) {
    const prefix = glob.replace(/\/\*\*?$/, "/");
    for (const file of files) {
      if (file.startsWith(prefix)) {
        // Get the first directory segment after the prefix
        const rest = file.slice(prefix.length);
        const nextSlash = rest.indexOf("/");
        if (nextSlash > 0) {
          dirs.add(prefix + rest.slice(0, nextSlash));
        }
      }
    }
  }

  return [...dirs].sort();
}

/**
 * Parse turbo.json or nx.json: packages are typically defined elsewhere
 * (package.json workspaces), so we look for those.
 */
async function parseJsonWorkspaces(_content: string, context: RepoContext): Promise<string[]> {
  // Check package.json for workspaces field
  const pkg = await context.readJson<{
    workspaces?: string[] | { packages?: string[] };
  }>("package.json");

  if (!pkg?.workspaces) return [];

  const globs = Array.isArray(pkg.workspaces) ? pkg.workspaces : (pkg.workspaces.packages ?? []);

  const packages: string[] = [];
  for (const glob of globs) {
    packages.push(...resolveWorkspaceGlob(glob, context.files));
  }

  return packages;
}

/**
 * Parse lerna.json for packages field.
 */
async function parseLernaConfig(content: string, context: RepoContext): Promise<string[]> {
  try {
    const config = JSON.parse(content) as { packages?: string[] };
    if (!config.packages) {
      // Default lerna packages
      return resolveWorkspaceGlob("packages/*", context.files);
    }
    const packages: string[] = [];
    for (const glob of config.packages) {
      packages.push(...resolveWorkspaceGlob(glob, context.files));
    }
    return packages;
  } catch {
    return [];
  }
}

/**
 * Parse Cargo.toml for workspace members.
 */
async function parseCargoWorkspace(content: string, context: RepoContext): Promise<string[]> {
  const packages: string[] = [];
  let inMembers = false;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.includes("[workspace]")) {
      continue;
    }
    if (trimmed.startsWith("members")) {
      inMembers = true;
      // Check for inline array
      const match = trimmed.match(/members\s*=\s*\[([^\]]*)\]/);
      if (match?.[1]) {
        const members = match[1].split(",").map((m) => m.trim().replace(/['"]/g, ""));
        for (const member of members) {
          if (member) {
            packages.push(...resolveWorkspaceGlob(member, context.files));
          }
        }
        inMembers = false;
      }
      continue;
    }
    if (inMembers) {
      if (trimmed === "]") {
        inMembers = false;
        continue;
      }
      const member = trimmed.replace(/['"",]/g, "").trim();
      if (member) {
        packages.push(...resolveWorkspaceGlob(member, context.files));
      }
    }
  }

  return packages;
}

/**
 * Parse go.work for workspace directories.
 */
async function parseGoWorkspace(content: string, _context: RepoContext): Promise<string[]> {
  const packages: string[] = [];
  let inUse = false;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "use (") {
      inUse = true;
      continue;
    }
    if (trimmed === ")") {
      inUse = false;
      continue;
    }
    if (inUse && trimmed) {
      packages.push(trimmed);
    }
    // Single-line use directive
    if (trimmed.startsWith("use ") && !trimmed.includes("(")) {
      packages.push(trimmed.slice(4).trim());
    }
  }

  return packages;
}

const MONOREPO_SPECS: MonorepoSpec[] = [
  {
    tool: "Turborepo",
    configFile: "turbo.json",
    extractPackages: parseJsonWorkspaces,
  },
  {
    tool: "Nx",
    configFile: "nx.json",
    extractPackages: parseJsonWorkspaces,
  },
  {
    tool: "Lerna",
    configFile: "lerna.json",
    extractPackages: parseLernaConfig,
  },
  {
    tool: "pnpm workspaces",
    configFile: "pnpm-workspace.yaml",
    extractPackages: parsePnpmWorkspace,
  },
  {
    tool: "Cargo workspaces",
    configFile: "Cargo.toml",
    extractPackages: parseCargoWorkspace,
  },
  {
    tool: "Go workspaces",
    configFile: "go.work",
    extractPackages: parseGoWorkspace,
  },
];

/**
 * Detect if the repository is a monorepo and identify the tool used.
 */
export async function detectMonorepo(context: RepoContext): Promise<DetectedMonorepo | null> {
  for (const spec of MONOREPO_SPECS) {
    const content = await context.readFile(spec.configFile);
    if (content === null) continue;

    // Special case: Cargo.toml is not a monorepo unless it has [workspace]
    if (spec.tool === "Cargo workspaces" && !content.includes("[workspace]")) {
      continue;
    }

    const packages = await spec.extractPackages(content, context);

    return {
      tool: spec.tool,
      workspaceRoot: ".",
      packages,
    };
  }

  return null;
}

/**
 * Context file generator (P2.01)
 *
 * Generates AGENTS.md files with measurably higher additionality than
 * naive generation. Uses gap analysis to determine what's missing,
 * then produces only additive content (>50% additionality threshold).
 *
 * Key design decisions:
 * - Heuristic analysis only — no LLM generation (deterministic + free)
 * - Front-loads critical info (build/test/constraints) in first 20%
 * - Progressive disclosure for monorepos (root + subdirectory files)
 * - Every section includes a rationale explaining why it was included
 *
 * Research basis: Gloaguen et al. (2026), Liu et al. (2024), Lulla et al. (2026)
 */

import type { RepoContext } from "../analyzers/analyzer.interface.js";
import type { DetectionResult } from "@prontiq/ariscan-schema";
import { analyzeGaps, type GapAnalysisResult } from "./gap-analysis.js";
import { computeAdditionality, computeFrontLoadScore } from "./additionality.js";

/** A generated context file with metadata */
export interface GeneratedContextFile {
  /** Relative path within the repo (e.g., "AGENTS.md" or "packages/engine/AGENTS.md") */
  path: string;
  /** Generated markdown content */
  content: string;
  /** Additionality score (0-100) against existing repo docs */
  additionality: number;
  /** Redundancy percentage against existing repo docs */
  redundancy: number;
  /** Front-load score (0-100): percentage of critical info in first 20% */
  frontLoadScore: number;
  /** Rationale for each section (section heading → why included) */
  rationale: Record<string, string>;
}

/** Result of context generation */
export interface GenerateResult {
  /** Generated context files (may include root + subdirectory files) */
  files: GeneratedContextFile[];
  /** Gap analysis that informed the generation */
  gapAnalysis: GapAnalysisResult;
}

/** Minimum additionality threshold for including a section */
const ADDITIONALITY_THRESHOLD = 50;

/**
 * Generate context files for a repository.
 *
 * Performs gap analysis first, then generates AGENTS.md content that
 * fills the identified gaps with only additive content.
 */
export async function generateContextFiles(
  context: RepoContext,
  detection?: DetectionResult,
): Promise<GenerateResult> {
  const gapAnalysis = await analyzeGaps(context, detection);

  const files: GeneratedContextFile[] = [];

  // Generate root-level AGENTS.md
  const rootFile = await generateRootAgentsMd(context, detection, gapAnalysis);
  if (rootFile) {
    files.push(rootFile);
  }

  // Progressive disclosure: generate subdirectory AGENTS.md for monorepo packages
  if (detection?.monorepo) {
    const subFiles = await generateSubdirectoryFiles(context, detection, gapAnalysis);
    files.push(...subFiles);
  }

  return { files, gapAnalysis };
}

/**
 * Generate root-level AGENTS.md from gap analysis.
 */
async function generateRootAgentsMd(
  context: RepoContext,
  detection: DetectionResult | undefined,
  gapAnalysis: GapAnalysisResult,
): Promise<GeneratedContextFile | null> {
  const sections: SectionDraft[] = [];
  const rationale: Record<string, string> = {};

  // --- Front-loaded sections (importance >= 8) ---

  // Build & test commands
  const buildGap = gapAnalysis.gaps.find((g) => g.category.id === "build-commands");
  const testGap = gapAnalysis.gaps.find((g) => g.category.id === "test-commands");

  if (buildGap || testGap) {
    const section = await generateBuildTestSection(context, detection);
    if (section) {
      sections.push(section);
      rationale["Build & Test Commands"] =
        "Build/test commands not found in easily-discoverable documentation. " +
        "Agents need these to validate changes (Gloaguen et al., 2026).";
    }
  }

  // Constraints
  const constraintGap = gapAnalysis.gaps.find((g) => g.category.id === "constraints");
  if (constraintGap) {
    const section = generateConstraintsSection(detection);
    sections.push(section);
    rationale["Constraints"] =
      "No explicit do-NOT constraints found. " +
      "Negative instructions are the most impactful content for agents (Liu et al., 2024).";
  }

  // Architecture overview
  const archGap = gapAnalysis.gaps.find((g) => g.category.id === "architecture-overview");
  if (archGap) {
    const section = await generateArchitectureSection(context, detection);
    sections.push(section);
    rationale["Architecture"] =
      "Architecture overview not found in documentation. " +
      "Agents need structural context to navigate codebases (arXiv 2510.05381).";
  }

  // Environment setup
  const envGap = gapAnalysis.gaps.find((g) => g.category.id === "env-setup");
  if (envGap) {
    const section = await generateEnvSection(context, detection);
    sections.push(section);
    rationale["Environment Setup"] =
      "Environment prerequisites not documented in an obvious location. " +
      "Agents fail on bootstrap without this (Lulla et al., 2026).";
  }

  // --- Mid-priority sections (importance 5-7) ---

  // Tool choices
  const toolGap = gapAnalysis.gaps.find((g) => g.category.id === "tool-choices");
  if (toolGap) {
    const section = generateToolChoicesSection(detection);
    if (section) {
      sections.push(section);
      rationale["Tool Choices"] =
        "Non-default tool choices not documented. " +
        "Agents assume defaults unless told otherwise.";
    }
  }

  // Gotchas
  const gotchaGap = gapAnalysis.gaps.find((g) => g.category.id === "gotchas");
  if (gotchaGap) {
    sections.push({
      heading: "Common Gotchas",
      content:
        "<!-- TODO: Document environment-specific gotchas and common pitfalls. -->\n" +
        "<!-- Examples: -->\n" +
        '<!-- - "Build order matters: schema -> engine -> cli" -->\n' +
        '<!-- - "Import extensions must use .js for ESM compatibility" -->\n' +
        '<!-- - "Database migrations must be run before tests" -->',
      importance: 7,
    });
    rationale["Common Gotchas"] =
      "No common pitfalls documented. " + "These prevent agents from making predictable mistakes.";
  }

  // Test patterns
  const testPatternGap = gapAnalysis.gaps.find((g) => g.category.id === "test-patterns");
  if (testPatternGap) {
    const section = generateTestPatternsSection(detection);
    sections.push(section);
    rationale["Testing Patterns"] =
      "Non-obvious test patterns not documented. " +
      "Agents need to know testing conventions to write conformant tests.";
  }

  // Code conventions
  const conventionGap = gapAnalysis.gaps.find((g) => g.category.id === "code-conventions");
  if (conventionGap) {
    sections.push({
      heading: "Code Conventions",
      content:
        "<!-- TODO: Document naming conventions and code style rules. -->\n" +
        "<!-- Examples: -->\n" +
        "<!-- - camelCase for variables/functions, PascalCase for types -->\n" +
        "<!-- - No `any` type — use `unknown` and narrow -->\n" +
        "<!-- - All exports must have JSDoc comments -->",
      importance: 4,
    });
    rationale["Code Conventions"] =
      "Code conventions not explicitly documented. " +
      "Agents may not infer conventions from code alone.";
  }

  // Monorepo paths
  if (detection?.monorepo) {
    const monoGap = gapAnalysis.gaps.find((g) => g.category.id === "monorepo-paths");
    if (monoGap) {
      const section = generateMonorepoSection(detection);
      sections.push(section);
      rationale["Monorepo Structure"] =
        "Monorepo structure not documented in agent-facing files. " +
        "Agents need package boundaries and dependency graph.";
    }
  }

  // If no gaps found, nothing to generate
  if (sections.length === 0) {
    return null;
  }

  // Sort by importance (highest first) to front-load critical info
  sections.sort((a, b) => b.importance - a.importance);

  // Build the file content
  const lines: string[] = [];
  lines.push("# AGENTS.md");
  lines.push("");
  lines.push("<!-- Generated by ariscan generate. Review and customize for your project. -->");
  lines.push("<!-- Each section includes a rationale comment explaining why it was included. -->");
  lines.push("");

  for (const section of sections) {
    lines.push(`## ${section.heading}`);
    lines.push("");
    lines.push(section.content);
    lines.push("");
  }

  const content = lines.join("\n").trimEnd() + "\n";

  // Score the generated content for additionality
  const addResult = computeAdditionality(
    content,
    "AGENTS.md (generated)",
    gapAnalysis.referenceDocs,
  );
  const frontLoadScore = computeFrontLoadScore(content);

  return {
    path: "AGENTS.md",
    content,
    additionality: addResult.additionalityPct >= 0 ? addResult.additionalityPct : 100,
    redundancy: addResult.redundancyPct >= 0 ? addResult.redundancyPct : 0,
    frontLoadScore,
    rationale,
  };
}

/**
 * Generate subdirectory AGENTS.md files for monorepo packages.
 * Only generates if the package has unique constraints not covered by root.
 */
async function generateSubdirectoryFiles(
  context: RepoContext,
  detection: DetectionResult,
  gapAnalysis: GapAnalysisResult,
): Promise<GeneratedContextFile[]> {
  const files: GeneratedContextFile[] = [];
  const mono = detection.monorepo;
  if (!mono) return files;

  for (const pkgPath of mono.packages) {
    // Check if package has its own package.json with unique scripts
    const pkgJsonPath = `${pkgPath}/package.json`;
    const pkgJson = await context.readJson<Record<string, unknown>>(pkgJsonPath);
    if (!pkgJson) continue;

    const scripts = pkgJson.scripts as Record<string, string> | undefined;
    if (!scripts || Object.keys(scripts).length === 0) continue;

    // Check if package already has a context file
    const existingContext = await context.fileExists(`${pkgPath}/AGENTS.md`);
    if (existingContext) continue;

    const pkgName =
      typeof pkgJson.name === "string" ? pkgJson.name : (pkgPath.split("/").pop() ?? pkgPath);

    const lines: string[] = [];
    lines.push(`# AGENTS.md — ${pkgName}`);
    lines.push("");
    lines.push(
      "<!-- Generated by ariscan generate. Package-specific context for this workspace package. -->",
    );
    lines.push("");

    lines.push("## Package Commands");
    lines.push("");
    lines.push("```bash");
    if (scripts.build) lines.push(`# build: pnpm --filter ${pkgName} build`);
    if (scripts.test) lines.push(`# test: pnpm --filter ${pkgName} test`);
    if (scripts.lint) lines.push(`# lint: pnpm --filter ${pkgName} lint`);
    lines.push("```");
    lines.push("");

    // Add description if present and not in root README
    if (typeof pkgJson.description === "string" && pkgJson.description.length > 10) {
      lines.push("## Overview");
      lines.push("");
      lines.push(pkgJson.description);
      lines.push("");
    }

    const content = lines.join("\n").trimEnd() + "\n";

    // Score against reference docs
    const addResult = computeAdditionality(
      content,
      `${pkgPath}/AGENTS.md (generated)`,
      gapAnalysis.referenceDocs,
    );

    // Only include if above additionality threshold
    const additionality = addResult.additionalityPct >= 0 ? addResult.additionalityPct : 100;
    if (additionality < ADDITIONALITY_THRESHOLD) continue;

    files.push({
      path: `${pkgPath}/AGENTS.md`,
      content,
      additionality,
      redundancy: addResult.redundancyPct >= 0 ? addResult.redundancyPct : 0,
      frontLoadScore: computeFrontLoadScore(content),
      rationale: {
        "Package Commands": `Package ${pkgName} has its own scripts that differ from root.`,
      },
    });
  }

  return files;
}

// --- Section generators ---

interface SectionDraft {
  heading: string;
  content: string;
  importance: number;
}

async function generateBuildTestSection(
  context: RepoContext,
  _detection?: DetectionResult,
): Promise<SectionDraft | null> {
  const lines: string[] = [];
  lines.push("<!-- Rationale: Build/test commands not found in easily-discoverable docs. -->");
  lines.push("");

  const pkgJson = await context.readJson<Record<string, unknown>>("package.json");

  if (pkgJson && typeof pkgJson === "object" && "scripts" in pkgJson) {
    const scripts = pkgJson.scripts as Record<string, string>;
    const pm = detectPackageManager(context);

    lines.push("```bash");
    if (scripts.install || scripts.prepare) lines.push(`${pm} install          # install deps`);
    if (scripts.build) lines.push(`${pm} build            # build all packages`);
    if (scripts.test) lines.push(`${pm} test             # run all tests`);
    if (scripts.lint) lines.push(`${pm} lint             # lint`);
    if (scripts.typecheck) lines.push(`${pm} typecheck        # type-check`);
    if (scripts.format) lines.push(`${pm} format           # format code`);
    lines.push("```");
  } else {
    const hasMakefile = await context.fileExists("Makefile");
    const hasCargoToml = await context.fileExists("Cargo.toml");
    const hasGoMod = await context.fileExists("go.mod");
    const hasPyproject = await context.fileExists("pyproject.toml");

    lines.push("```bash");
    if (hasMakefile) lines.push("make build && make test");
    else if (hasCargoToml) lines.push("cargo build && cargo test");
    else if (hasGoMod) lines.push("go build ./... && go test ./...");
    else if (hasPyproject) lines.push("pip install -e '.[dev]' && pytest");
    else lines.push("# TODO: Add your build and test commands here");
    lines.push("```");
  }

  return { heading: "Build & Test Commands", content: lines.join("\n"), importance: 10 };
}

function generateConstraintsSection(detection: DetectionResult | undefined): SectionDraft {
  const lines: string[] = [];
  lines.push(
    "<!-- Rationale: No explicit constraints found. These are the most impactful content. -->",
  );
  lines.push("");
  lines.push("<!-- TODO: Add explicit constraints agents must follow. -->");
  lines.push("<!-- Negative instructions ('do NOT') are the most valuable for agents. -->");

  // Add framework-specific constraints if detectable
  if (detection) {
    const hints: string[] = [];
    for (const lang of detection.languages) {
      if (lang.language === "TypeScript") {
        hints.push("- Do NOT use the `any` type — use `unknown` and narrow");
      }
    }
    for (const fw of detection.frameworks) {
      if (fw.framework === "Next.js") {
        hints.push("- Do NOT import server-only modules in client components");
      }
    }
    if (hints.length > 0) {
      lines.push("");
      lines.push("<!-- Suggested constraints based on detected stack: -->");
      for (const hint of hints) {
        lines.push(`<!-- ${hint} -->`);
      }
    }
  }

  return { heading: "Constraints", content: lines.join("\n"), importance: 9 };
}

async function generateArchitectureSection(
  context: RepoContext,
  detection?: DetectionResult,
): Promise<SectionDraft> {
  const lines: string[] = [];
  lines.push("<!-- Rationale: Architecture overview not found in documentation. -->");
  lines.push("");

  // Auto-discover top-level directories
  const topDirs = new Set<string>();
  for (const file of context.files) {
    const parts = file.split("/");
    if (parts.length > 1 && parts[0]) {
      // Skip hidden dirs and common noise
      if (!parts[0].startsWith(".") && !["node_modules", "dist", "coverage"].includes(parts[0])) {
        topDirs.add(parts[0]);
      }
    }
  }

  if (topDirs.size > 0) {
    lines.push("```");
    for (const dir of [...topDirs].sort()) {
      lines.push(`${dir}/`);
    }
    lines.push("```");
    lines.push("");
  }

  if (detection?.monorepo) {
    lines.push(`Monorepo managed with ${detection.monorepo.tool}.`);
    lines.push("");
  }

  lines.push("<!-- TODO: Add dependency flow, key abstractions, and design decisions. -->");

  return { heading: "Architecture", content: lines.join("\n"), importance: 8 };
}

async function generateEnvSection(
  context: RepoContext,
  _detection?: DetectionResult,
): Promise<SectionDraft> {
  const lines: string[] = [];
  lines.push(
    "<!-- Rationale: Environment prerequisites not documented in an obvious location. -->",
  );
  lines.push("");

  // Detect Node version
  const nvmrc = await context.readFile(".nvmrc");
  const nodeVersion = await context.readFile(".node-version");
  const toolVersions = await context.readFile(".tool-versions");

  if (nvmrc) {
    lines.push(`- Node.js: ${nvmrc.trim()}`);
  } else if (nodeVersion) {
    lines.push(`- Node.js: ${nodeVersion.trim()}`);
  } else if (toolVersions) {
    const nodeMatch = /nodejs\s+(\S+)/.exec(toolVersions);
    if (nodeMatch?.[1]) lines.push(`- Node.js: ${nodeMatch[1]}`);
  }

  // Detect package manager
  if (context.files.some((f) => f === "pnpm-lock.yaml")) {
    lines.push("- Package manager: pnpm");
  } else if (context.files.some((f) => f === "yarn.lock")) {
    lines.push("- Package manager: yarn");
  } else if (context.files.some((f) => f === "package-lock.json")) {
    lines.push("- Package manager: npm");
  }

  // Python
  const pyVersion = await context.readFile(".python-version");
  if (pyVersion) {
    lines.push(`- Python: ${pyVersion.trim()}`);
  }

  // Rust
  const rustToolchain = await context.readFile("rust-toolchain.toml");
  if (rustToolchain) {
    const channelMatch = /channel\s*=\s*"([^"]+)"/.exec(rustToolchain);
    if (channelMatch?.[1]) lines.push(`- Rust: ${channelMatch[1]}`);
  }

  if (lines.filter((l) => l.startsWith("- ")).length === 0) {
    lines.push("<!-- TODO: List required runtime versions and tools. -->");
  }

  return { heading: "Environment Setup", content: lines.join("\n"), importance: 8 };
}

function generateToolChoicesSection(detection: DetectionResult | undefined): SectionDraft | null {
  if (!detection || detection.frameworks.length === 0) return null;

  const lines: string[] = [];
  lines.push(
    "<!-- Rationale: Non-default tool choices not documented. Agents assume defaults unless told. -->",
  );
  lines.push("");

  for (const fw of detection.frameworks) {
    lines.push(`- **${fw.framework}** (confidence: ${Math.round(fw.confidence * 100)}%)`);
  }

  lines.push("");
  lines.push("<!-- TODO: Document why these tools were chosen over alternatives. -->");

  return { heading: "Tool Choices", content: lines.join("\n"), importance: 7 };
}

function generateTestPatternsSection(detection: DetectionResult | undefined): SectionDraft {
  const lines: string[] = [];
  lines.push("<!-- Rationale: Non-obvious test patterns not documented. -->");
  lines.push("");
  lines.push("<!-- TODO: Document test conventions agents should follow. -->");
  lines.push("<!-- Examples: -->");

  if (detection) {
    for (const lang of detection.languages) {
      if (lang.language === "TypeScript" || lang.language === "JavaScript") {
        lines.push('<!-- - "Use vitest/jest for unit tests" -->');
        lines.push('<!-- - "Mock filesystem via abstraction, never use real fs in tests" -->');
        break;
      }
      if (lang.language === "Python") {
        lines.push('<!-- - "Use pytest with fixtures" -->');
        break;
      }
      if (lang.language === "Go") {
        lines.push('<!-- - "Use table-driven tests" -->');
        break;
      }
    }
  }

  return { heading: "Testing Patterns", content: lines.join("\n"), importance: 6 };
}

function generateMonorepoSection(detection: DetectionResult): SectionDraft {
  const mono = detection.monorepo;
  if (!mono) {
    return { heading: "Monorepo Structure", content: "", importance: 5 };
  }

  const lines: string[] = [];
  lines.push("<!-- Rationale: Monorepo structure not documented in agent-facing files. -->");
  lines.push("");
  lines.push(`This repository uses **${mono.tool}** with ${mono.packages.length} package(s):`);
  lines.push("");
  for (const pkg of mono.packages) {
    lines.push(`- \`${pkg}\``);
  }
  lines.push("");
  lines.push("<!-- TODO: Document dependency flow between packages and build order. -->");

  return { heading: "Monorepo Structure", content: lines.join("\n"), importance: 5 };
}

/**
 * Detect the likely package manager from the repo's files.
 */
function detectPackageManager(context: RepoContext): string {
  if (context.files.some((f) => f === "pnpm-lock.yaml")) return "pnpm";
  if (context.files.some((f) => f === "yarn.lock")) return "yarn";
  return "npm";
}

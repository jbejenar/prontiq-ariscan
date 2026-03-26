#!/usr/bin/env node
/**
 * Validate P1.03 Testing: Zero false negatives on benchmark cohort.
 *
 * Two modes:
 *   --local <dir>   Use already-cloned repos in <dir> (fastest)
 *   --api           Use GitHub API to check file existence (no cloning needed)
 *   (default)       Use GitHub API
 *
 * For each benchmark repo, checks that every context file present in the repo
 * was discovered by the scanner.
 *
 * Usage:
 *   node benchmarks/validate-context-discovery.cjs
 *   node benchmarks/validate-context-discovery.cjs --local /tmp/ari-benchmark-repos
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const RESULTS_DIR = path.join(__dirname, "results");
const REVISIONS = JSON.parse(fs.readFileSync(path.join(__dirname, "revisions.json"), "utf8"));

// Context file patterns the scanner probes for (from packages/engine/src/scan.ts)
const ROOT_CONTEXT_FILES = [
  "AGENTS.md",
  "CLAUDE.md",
  ".cursorrules",
  ".cursor/rules",
  ".github/copilot-instructions.md",
  ".aider.conf.yml",
  ".aiderignore",
  ".agentignore",
  ".mcp.json",
  "mcp.config.js",
  ".claude/settings.json",
];

const useLocal = process.argv.includes("--local");
const localDir = useLocal ? process.argv[process.argv.indexOf("--local") + 1] : null;

/**
 * Check if a file exists in a GitHub repo at a specific ref using the API.
 * Returns true/false.
 */
function ghFileExists(repo, ref, filePath) {
  try {
    execSync(`gh api "repos/${repo}/contents/${filePath}?ref=${ref}" --jq .name`, {
      encoding: "utf8",
      timeout: 15000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * List files matching nested patterns using GitHub API tree endpoint.
 * Returns array of file paths matching nested AGENTS.md or .claude/commands/*.
 */
function ghListNestedContextFiles(repo, ref) {
  try {
    const output = execSync(
      `gh api "repos/${repo}/git/trees/${ref}?recursive=1" --jq '.tree[].path'`,
      { encoding: "utf8", timeout: 30000, stdio: ["pipe", "pipe", "pipe"] },
    );
    const files = output.trim().split("\n").filter(Boolean);
    return files.filter(
      (f) => (/\/AGENTS\.md$/.test(f) && f !== "AGENTS.md") || f.startsWith(".claude/commands/"),
    );
  } catch {
    return [];
  }
}

/**
 * Check context files using local filesystem.
 */
function localGroundTruth(repoDir) {
  const found = [];
  for (const cfPath of ROOT_CONTEXT_FILES) {
    if (fs.existsSync(path.join(repoDir, cfPath))) {
      found.push(cfPath);
    }
  }
  try {
    const allFiles = execSync(`git -C "${repoDir}" ls-files`, {
      encoding: "utf8",
      timeout: 30000,
      stdio: ["pipe", "pipe", "pipe"],
    })
      .trim()
      .split("\n")
      .filter(Boolean);
    for (const f of allFiles) {
      if (/\/AGENTS\.md$/.test(f) && f !== "AGENTS.md") found.push(f);
      if (f.startsWith(".claude/commands/")) found.push(f);
    }
  } catch {
    // skip nested
  }
  return found;
}

async function main() {
  let totalRepos = 0;
  let totalFiles = 0;
  let falseNegatives = 0;
  const details = [];

  for (const entry of REVISIONS.repos) {
    const resultFile = path.join(RESULTS_DIR, entry.name + ".json");

    if (!fs.existsSync(resultFile)) {
      console.log(`SKIP ${entry.name}: no scan result`);
      continue;
    }

    const scanResult = JSON.parse(fs.readFileSync(resultFile, "utf8"));
    const discoveredPaths = new Set((scanResult.contextFiles || []).map((cf) => cf.path));

    let groundTruth;

    if (useLocal) {
      const repoDir = path.join(localDir, entry.name);
      if (!fs.existsSync(repoDir)) {
        console.log(`SKIP ${entry.name}: not cloned at ${repoDir}`);
        continue;
      }
      groundTruth = localGroundTruth(repoDir);
    } else {
      // Use GitHub API
      groundTruth = [];
      for (const cfPath of ROOT_CONTEXT_FILES) {
        if (ghFileExists(entry.repo, entry.ref, cfPath)) {
          groundTruth.push(cfPath);
        }
      }
      const nested = ghListNestedContextFiles(entry.repo, entry.ref);
      groundTruth.push(...nested);
    }

    totalRepos++;
    totalFiles += groundTruth.length;

    const missed = groundTruth.filter((gt) => !discoveredPaths.has(gt));
    falseNegatives += missed.length;

    if (missed.length > 0) {
      details.push({
        repo: entry.name,
        missed,
        discovered: [...discoveredPaths],
      });
    }

    const status = missed.length === 0 ? "PASS" : "FAIL";
    console.log(
      `${status} ${entry.name}: ${groundTruth.length} ground-truth files, ${discoveredPaths.size} discovered, ${missed.length} missed`,
    );
    if (missed.length > 0) {
      missed.forEach((m) => console.log(`  MISSED: ${m}`));
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log(`Repos validated: ${totalRepos}`);
  console.log(`Total context files (ground truth): ${totalFiles}`);
  console.log(`False negatives: ${falseNegatives}`);
  console.log(
    `False negative rate: ${totalFiles > 0 ? ((falseNegatives / totalFiles) * 100).toFixed(1) : 0}%`,
  );
  console.log(`Result: ${falseNegatives === 0 ? "PASS" : "FAIL"}`);

  if (details.length > 0) {
    console.log("\nDetails:");
    details.forEach((d) => {
      console.log(`  ${d.repo}: missed=${JSON.stringify(d.missed)}`);
      console.log(`    discovered=${JSON.stringify(d.discovered)}`);
    });
  }

  console.log("\nMethodology:");
  console.log(`  - Mode: ${useLocal ? "local filesystem" : "GitHub API"}`);
  console.log(
    "  - Ground truth: checked 11 root-level context file paths + nested AGENTS.md + .claude/commands/*",
  );
  console.log("  - Compared against scanner's contextFiles array in benchmark results");
  console.log("  - False negative = file exists in repo but not in scan result");

  process.exit(falseNegatives === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});

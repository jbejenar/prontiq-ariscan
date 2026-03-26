#!/usr/bin/env node
// Benchmark runner in Node.js (sandbox-compatible alternative to run.sh)
// Usage: node benchmarks/run-benchmark.cjs [--pin-refs]

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const SCRIPT_DIR = __dirname;
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const REVISIONS_FILE = path.join(SCRIPT_DIR, "revisions.json");
const RESULTS_DIR = path.join(SCRIPT_DIR, "results");
const ARISCAN = path.join(REPO_ROOT, "packages/cli/dist/cli.js");
const PIN_REFS = process.argv.includes("--pin-refs");

// Validate and resolve CLONE_DIR to prevent shell injection via env var
const rawCloneDir = process.env.ARI_BENCH_CLONE_DIR || "/tmp/ari-benchmark-repos";
const CLONE_DIR = path.resolve(rawCloneDir);

// Validation helpers — reject values containing shell metacharacters
const SAFE_NAME_RE = /^[a-zA-Z0-9_.-]+$/;
const SAFE_REF_RE = /^[a-zA-Z0-9_./-]+$/;
const SAFE_REPO_RE = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;

function validateField(value, pattern, label) {
  if (!pattern.test(value)) {
    throw new Error(
      `Invalid ${label}: "${value}" — must match ${pattern}. Aborting to prevent command injection.`,
    );
  }
}

// Ensure prerequisites
if (!fs.existsSync(REVISIONS_FILE)) {
  console.error("ERROR: revisions.json not found");
  process.exit(1);
}
if (!fs.existsSync(ARISCAN)) {
  console.error("ERROR: ariscan CLI not built. Run 'pnpm build' first.");
  process.exit(1);
}

fs.mkdirSync(RESULTS_DIR, { recursive: true });
fs.mkdirSync(CLONE_DIR, { recursive: true });

const data = JSON.parse(fs.readFileSync(REVISIONS_FILE, "utf8"));
const repos = data.repos;

console.log("═══════════════════════════════════════════════════════════");
console.log("  ARI Benchmark Runner (Node.js)");
console.log(`  Scoring version: ${data.scoring_version} | Rubric: ${data.rubric_version}`);
console.log(`  Repos: ${repos.length}`);
console.log("═══════════════════════════════════════════════════════════\n");

let passCount = 0;
let failCount = 0;
const pinnedShas = [];
const results = [];

for (let i = 0; i < repos.length; i++) {
  const { name, repo, ref, language, description } = repos[i];

  // Validate inputs before using in shell commands
  validateField(name, SAFE_NAME_RE, `repos[${i}].name`);
  validateField(repo, SAFE_REPO_RE, `repos[${i}].repo`);
  validateField(ref, SAFE_REF_RE, `repos[${i}].ref`);

  const clonePath = path.join(CLONE_DIR, name);

  console.log(`[${i + 1}/${repos.length}] ${name} (${repo} @ ${ref})`);

  // Clone if not already present
  if (!fs.existsSync(clonePath)) {
    console.log("  Cloning (shallow)...");
    try {
      execSync(
        `git clone --depth 1 --branch "${ref}" "https://github.com/${repo}.git" "${clonePath}"`,
        { stdio: "pipe", timeout: 120000 },
      );
    } catch (e) {
      console.log(`  WARNING: Failed to clone ${repo}. Skipping.`);
      failCount++;
      pinnedShas.push("SKIP");
      const meta = { name, repo, ref, clonedAt: null, error: "clone failed" };
      fs.writeFileSync(
        path.join(RESULTS_DIR, `${name}.meta.json`),
        JSON.stringify(meta, null, 2) + "\n",
      );
      console.log("");
      continue;
    }
  } else {
    console.log("  Using cached clone.");
  }

  // Get commit SHA
  let commitSha;
  try {
    commitSha = execSync("git rev-parse HEAD", { cwd: clonePath, encoding: "utf8" }).trim();
  } catch {
    commitSha = "unknown";
  }
  pinnedShas.push(commitSha);

  // Run ariscan
  console.log("  Scanning...");
  const resultFile = path.join(RESULTS_DIR, `${name}.json`);
  try {
    const output = execSync(`node "${ARISCAN}" "${clonePath}" --format json`, {
      encoding: "utf8",
      timeout: 300000,
      maxBuffer: 50 * 1024 * 1024,
    });
    fs.writeFileSync(resultFile, output);

    const result = JSON.parse(output);
    const score = result.score;
    const level = result.level;
    console.log(`  Score: ${score}/100 (${level})`);
    passCount++;

    results.push({ name, repo, ref, language, commitSha, score, level, description });

    const meta = { name, repo, ref, commitSha, scannedAt: new Date().toISOString() };
    fs.writeFileSync(
      path.join(RESULTS_DIR, `${name}.meta.json`),
      JSON.stringify(meta, null, 2) + "\n",
    );
  } catch (e) {
    console.log(`  WARNING: Scan failed for ${name}. ${e.message?.slice(0, 200)}`);
    failCount++;
    const meta = { name, repo, ref, commitSha, error: "scan failed" };
    fs.writeFileSync(
      path.join(RESULTS_DIR, `${name}.meta.json`),
      JSON.stringify(meta, null, 2) + "\n",
    );
    if (fs.existsSync(resultFile)) fs.unlinkSync(resultFile);
  }

  console.log("");
}

// Build summary
const summary = {
  version: data.version,
  scoring_version: data.scoring_version,
  rubric_version: data.rubric_version,
  date: new Date().toISOString().slice(0, 10),
  total: repos.length,
  scanned: passCount,
  failed: failCount,
  results: results.sort((a, b) => b.score - a.score),
};
fs.writeFileSync(path.join(RESULTS_DIR, "summary.json"), JSON.stringify(summary, null, 2) + "\n");

console.log("═══════════════════════════════════════════════════════════");
console.log(`  Summary: ${passCount} scanned, ${failCount} failed`);
console.log(`  Results: ${RESULTS_DIR}/`);
console.log(`  Summary: ${RESULTS_DIR}/summary.json`);
console.log("═══════════════════════════════════════════════════════════");

// Pin refs — re-read the file to avoid TOCTOU race condition
if (PIN_REFS) {
  console.log("\nPinning refs to resolved commit SHAs...");
  const freshData = JSON.parse(fs.readFileSync(REVISIONS_FILE, "utf8"));
  let pinned = 0;
  freshData.repos.forEach((r, i) => {
    if (pinnedShas[i] && pinnedShas[i] !== "SKIP") {
      r.ref = pinnedShas[i];
      pinned++;
    }
  });
  fs.writeFileSync(REVISIONS_FILE, JSON.stringify(freshData, null, 2) + "\n");
  console.log(`Updated ${pinned}/${repos.length} refs in ${REVISIONS_FILE}`);
}

// Output results table
console.log("\n═══════════════════════════════════════════════════════════");
console.log("  Results Table");
console.log("═══════════════════════════════════════════════════════════");
console.log("| Repo | Language | Score | Level |");
console.log("|------|----------|-------|-------|");
for (const r of results) {
  console.log(`| ${r.name} | ${r.language} | ${r.score} | ${r.level} |`);
}

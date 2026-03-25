import type { Archetype, Finding, PillarResult } from "@prontiq/ariscan-schema";

/**
 * Per-archetype map of finding codes that are NOT_APPLICABLE.
 *
 * Findings in this map are excluded from pillar score calculation for the
 * given archetype. They are hidden in default output and shown dimmed in
 * verbose mode.
 *
 * Code mapping (verified against actual analyzer implementations):
 *   ARI-SEC-001  CODEOWNERS             (+15 pts to P8)
 *   ARI-SEC-002  SECURITY.md            (+10 pts to P8)
 *   ARI-SEC-003  Secrets scanning       (+15 pts to P8)
 *   ARI-SEC-004  Dependency automation  (+15 pts to P8)
 *   ARI-SEC-005  PR template AI review  (+ 5 pts to P8)
 *   ARI-SEC-007  License compliance     (+ 5 pts to P8)
 *   ARI-SEC-009  Branch protection      (+15 pts to P8)
 *   ARI-SEC-010  SAST in CI             (+15 pts to P8)
 *   ARI-FBK-006  Commitlint/changesets  (+ 5 pts to P2)
 */
const NOT_APPLICABLE_MAP: Record<Archetype, ReadonlySet<string>> = {
  "solo-hobby": new Set([
    "ARI-SEC-001", // CODEOWNERS — solo dev, no team to assign
    "ARI-SEC-002", // SECURITY.md — overkill for hobby projects
    "ARI-SEC-004", // Dependency automation — minimal deps typical
    "ARI-SEC-005", // PR template — solo dev doesn't review own PRs
    "ARI-SEC-007", // License compliance — hobby project
    "ARI-SEC-009", // Branch protection — solo dev
    "ARI-SEC-010", // SAST — overkill for hobby projects
    "ARI-FBK-006", // Commitlint/changesets — solo dev
  ]),

  "small-team": new Set([
    "ARI-SEC-007", // License compliance — often unnecessary for small teams
  ]),

  library: new Set([
    // No finding exclusions — library authors should have good governance
  ]),

  "api-service": new Set([
    // API services benefit from all governance checks
  ]),

  "cli-tool": new Set([
    // CLI tools benefit from all governance checks
  ]),

  "monorepo-enterprise": new Set([
    // All findings applicable — enterprise repos should meet all criteria
  ]),
};

/**
 * Point values each finding code contributes to its pillar score.
 * When a finding is present (thing is missing), the pillar didn't get these points.
 * When we exclude a finding as not-applicable, we add these points back.
 */
const FINDING_POINT_VALUES: Record<string, number> = {
  "ARI-SEC-001": 15, // CODEOWNERS
  "ARI-SEC-002": 10, // SECURITY.md
  "ARI-SEC-003": 15, // Secrets scanning
  "ARI-SEC-004": 15, // Dependency automation
  "ARI-SEC-005": 5, // PR template AI review
  "ARI-SEC-007": 5, // License compliance
  "ARI-SEC-009": 15, // Branch protection
  "ARI-SEC-010": 15, // SAST
  "ARI-FBK-006": 5, // Commitlint/changesets
};

/**
 * Get the set of finding codes that are not applicable for a given archetype.
 */
export function getNotApplicableCodes(archetype: Archetype): ReadonlySet<string> {
  return NOT_APPLICABLE_MAP[archetype];
}

/**
 * Annotate findings with applicability based on the repo archetype.
 * Returns new finding objects with the `applicability` field set.
 */
export function annotateApplicability(findings: Finding[], archetype: Archetype): Finding[] {
  const excluded = NOT_APPLICABLE_MAP[archetype];
  if (excluded.size === 0) return findings;

  return findings.map((f) => {
    if (excluded.has(f.code)) {
      return { ...f, applicability: "not-applicable" as const };
    }
    return { ...f, applicability: "applicable" as const };
  });
}

/**
 * Adjust pillar results for not-applicable findings.
 * For each not-applicable finding present in a pillar's findings, the pillar
 * score is increased by the finding's point value (the points the repo
 * "lost" for not having something irrelevant to its archetype).
 *
 * Findings are annotated with applicability and not-applicable ones are kept
 * in the findings array (for verbose display) but marked accordingly.
 */
export function adjustPillarResults(pillars: PillarResult[], archetype: Archetype): PillarResult[] {
  const excluded = NOT_APPLICABLE_MAP[archetype];
  if (excluded.size === 0) return pillars;

  return pillars.map((pr) => {
    // Find not-applicable findings in this pillar
    const naFindings = pr.findings.filter((f) => excluded.has(f.code));
    if (naFindings.length === 0) return pr;

    // Calculate score adjustment
    const pointsToRestore = naFindings.reduce(
      (sum, f) => sum + (FINDING_POINT_VALUES[f.code] ?? 0),
      0,
    );

    // Annotate findings
    const annotatedFindings = pr.findings.map((f) => {
      if (excluded.has(f.code)) {
        return { ...f, applicability: "not-applicable" as const };
      }
      return { ...f, applicability: "applicable" as const };
    });

    return {
      ...pr,
      score: Math.min(100, pr.score + pointsToRestore),
      findings: annotatedFindings,
    };
  });
}

/**
 * Count findings that are not applicable for a given archetype.
 */
export function countNotApplicable(findings: Finding[], archetype: Archetype): number {
  const excluded = NOT_APPLICABLE_MAP[archetype];
  return findings.filter((f) => excluded.has(f.code)).length;
}

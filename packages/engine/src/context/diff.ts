/**
 * Context delta viewer — P2.03
 *
 * Compares all context files in a repository, classifying each segment as:
 *   - additive (unique to this file, not in repo docs or other context files)
 *   - duplicative-repo (duplicates existing repo documentation)
 *   - duplicative-context (duplicates another context file)
 *   - overlapping (partial match with repo docs or other context files)
 *
 * Generates deduplication recommendations for high-overlap file pairs.
 */

import type { RepoContext } from "../analyzers/analyzer.interface.js";
import type { DetectionResult } from "@prontiq/ariscan-schema";
import { discoverContextFiles } from "../audit/agents-md.js";
import {
  normalizeForComparison,
  splitSegments,
  jaccardSimilarity,
  REFERENCE_DOC_PATHS,
  REFERENCE_CONFIG_PATHS,
  DYNAMIC_CONFIG_PATTERNS,
  SOURCE_EXTENSIONS,
  MAX_SOURCE_FILES_FOR_DOCSTRINGS,
  CI_WORKFLOW_PREFIXES,
  normalizeConfigContent,
  extractLeadingDocstring,
} from "./additionality.js";
import type { ReferenceDoc } from "./additionality.js";

// ─── Types ────────────────────────────────────────────────────────────────

/** Classification of a content segment */
export type SegmentClass = "additive" | "duplicative-repo" | "duplicative-context" | "overlapping";

/** A classified segment of a context file */
export interface DiffSegment {
  text: string;
  classification: SegmentClass;
  /** Source file path when duplicative or overlapping */
  matchedIn?: string;
  /** Jaccard similarity score of the best match (0-1) */
  similarity: number;
}

/** Per-file diff analysis result */
export interface ContextFileDiff {
  path: string;
  tokenEstimate: number;
  segments: DiffSegment[];
  /** Percentage of content that is additive (unique to this file) */
  additivePct: number;
  /** Percentage duplicating repo documentation */
  duplicativeRepoPct: number;
  /** Percentage duplicating other context files */
  duplicativeContextPct: number;
  /** Percentage with partial overlap */
  overlappingPct: number;
}

/** A recommendation for deduplication */
export interface DeduplicationRecommendation {
  /** Action type */
  action: "merge" | "remove-section" | "consolidate";
  /** Description of the recommendation */
  description: string;
  /** Files involved */
  files: string[];
  /** Overlap percentage between the files */
  overlapPct: number;
}

/** Overall diff result */
export interface DiffResult {
  files: ContextFileDiff[];
  recommendations: DeduplicationRecommendation[];
  /** Total context files found */
  totalFiles: number;
}

// ─── Constants ────────────────────────────────────────────────────────────

/** Threshold for segment match (same as additionality.ts) */
const SIMILARITY_THRESHOLD = 0.6;

/** Threshold for partial/overlapping match */
const OVERLAP_THRESHOLD = 0.35;

/** Overlap % above which we recommend merging */
const MERGE_RECOMMENDATION_THRESHOLD = 50;

/** Rough token estimate: ~4 chars per token */
const CHARS_PER_TOKEN = 4;

// ─── Implementation ──────────────────────────────────────────────────────

/**
 * Build reference corpus from repo documentation (excluding context files).
 * Same logic as audit/agents-md.ts buildReferenceDocs.
 */
async function buildReferenceDocs(ctx: RepoContext): Promise<ReferenceDoc[]> {
  const docs: ReferenceDoc[] = [];

  for (const path of REFERENCE_DOC_PATHS) {
    const content = await ctx.readFile(path);
    if (content) docs.push({ path, content });
  }

  for (const path of REFERENCE_CONFIG_PATHS) {
    const content = await ctx.readFile(path);
    if (content) docs.push({ path, content: normalizeConfigContent(content, path) });
  }

  for (const file of ctx.files) {
    const base = file.split("/").pop() ?? "";
    if (DYNAMIC_CONFIG_PATTERNS.some((p) => p.test(base))) {
      const content = await ctx.readFile(file);
      if (content) docs.push({ path: file, content: normalizeConfigContent(content, file) });
    }
  }

  for (const file of ctx.files) {
    if (CI_WORKFLOW_PREFIXES.some((prefix) => file.startsWith(prefix))) {
      const content = await ctx.readFile(file);
      if (content) docs.push({ path: file, content });
    }
  }

  let sourceCount = 0;
  for (const file of ctx.files) {
    if (sourceCount >= MAX_SOURCE_FILES_FOR_DOCSTRINGS) break;
    if (SOURCE_EXTENSIONS.some((ext) => file.endsWith(ext))) {
      const content = await ctx.readFile(file);
      if (content) {
        sourceCount++;
        const docstring = extractLeadingDocstring(content);
        if (docstring) docs.push({ path: file, content: docstring });
      }
    }
  }

  return docs;
}

/**
 * Compute pairwise overlap between two context files.
 * Returns the percentage of file A's segments that match file B.
 */
function computePairwiseOverlap(
  segmentsA: string[],
  segmentsB: Array<{ segment: string; path: string }>,
): { matchCount: number; totalSegments: number; overlapPct: number } {
  let matchCount = 0;
  const totalSegments = segmentsA.length;

  for (const segA of segmentsA) {
    for (const segB of segmentsB) {
      if (jaccardSimilarity(segA, segB.segment) >= SIMILARITY_THRESHOLD) {
        matchCount++;
        break;
      }
    }
  }

  const overlapPct = totalSegments > 0 ? Math.round((matchCount / totalSegments) * 1000) / 10 : 0;
  return { matchCount, totalSegments, overlapPct };
}

/**
 * Analyze context file delta across all context files in the repository.
 *
 * For each context file, classifies every segment as additive, duplicative-repo,
 * duplicative-context, or overlapping. Generates deduplication recommendations.
 */
export async function diffContext(
  ctx: RepoContext,
  _detection: DetectionResult,
): Promise<DiffResult> {
  const contextPaths = await discoverContextFiles(ctx);

  if (contextPaths.length === 0) {
    return { files: [], recommendations: [], totalFiles: 0 };
  }

  // Read all context files
  const contextFiles: Array<{ path: string; content: string }> = [];
  for (const path of contextPaths) {
    const content = await ctx.readFile(path);
    if (content !== null) {
      contextFiles.push({ path, content });
    }
  }

  // Build repo reference corpus (excludes context files)
  const referenceDocs = await buildReferenceDocs(ctx);

  // Pre-compute normalized segments for repo docs
  const repoSegments: Array<{ segment: string; path: string }> = [];
  for (const doc of referenceDocs) {
    const normalized = normalizeForComparison(doc.content);
    for (const seg of splitSegments(normalized)) {
      repoSegments.push({ segment: seg, path: doc.path });
    }
  }

  // Pre-compute normalized segments for each context file
  const contextSegmentMap = new Map<
    string,
    { raw: string[]; indexed: Array<{ segment: string; path: string }> }
  >();
  for (const file of contextFiles) {
    const normalized = normalizeForComparison(file.content);
    const segs = splitSegments(normalized);
    contextSegmentMap.set(file.path, {
      raw: segs,
      indexed: segs.map((s) => ({ segment: s, path: file.path })),
    });
  }

  // Analyze each context file
  const fileDiffs: ContextFileDiff[] = [];
  for (const file of contextFiles) {
    const mySegments = contextSegmentMap.get(file.path)?.raw ?? [];

    // Build other-context-file segments (all context files except this one)
    const otherContextSegments: Array<{ segment: string; path: string }> = [];
    for (const other of contextFiles) {
      if (other.path === file.path) continue;
      const otherData = contextSegmentMap.get(other.path);
      if (otherData) {
        otherContextSegments.push(...otherData.indexed);
      }
    }

    // Classify each segment
    const segments: DiffSegment[] = [];
    let additive = 0;
    let dupRepo = 0;
    let dupContext = 0;
    let overlapping = 0;

    for (const seg of mySegments) {
      // Check against repo docs
      let bestRepoSim = 0;
      let bestRepoPath = "";
      for (const ref of repoSegments) {
        const sim = jaccardSimilarity(seg, ref.segment);
        if (sim > bestRepoSim) {
          bestRepoSim = sim;
          bestRepoPath = ref.path;
        }
      }

      // Check against other context files
      let bestCtxSim = 0;
      let bestCtxPath = "";
      for (const ref of otherContextSegments) {
        const sim = jaccardSimilarity(seg, ref.segment);
        if (sim > bestCtxSim) {
          bestCtxSim = sim;
          bestCtxPath = ref.path;
        }
      }

      // Classify: strongest match wins
      const bestSim = Math.max(bestRepoSim, bestCtxSim);
      let classification: SegmentClass;
      let matchedIn: string | undefined;

      if (bestSim >= SIMILARITY_THRESHOLD) {
        if (bestRepoSim >= bestCtxSim) {
          classification = "duplicative-repo";
          matchedIn = bestRepoPath;
          dupRepo++;
        } else {
          classification = "duplicative-context";
          matchedIn = bestCtxPath;
          dupContext++;
        }
      } else if (bestSim >= OVERLAP_THRESHOLD) {
        classification = "overlapping";
        matchedIn = bestRepoSim >= bestCtxSim ? bestRepoPath : bestCtxPath;
        overlapping++;
      } else {
        classification = "additive";
        additive++;
      }

      segments.push({ text: seg, classification, matchedIn, similarity: bestSim });
    }

    const total = mySegments.length || 1; // avoid division by zero
    fileDiffs.push({
      path: file.path,
      tokenEstimate: Math.ceil(file.content.length / CHARS_PER_TOKEN),
      segments,
      additivePct: Math.round((additive / total) * 1000) / 10,
      duplicativeRepoPct: Math.round((dupRepo / total) * 1000) / 10,
      duplicativeContextPct: Math.round((dupContext / total) * 1000) / 10,
      overlappingPct: Math.round((overlapping / total) * 1000) / 10,
    });
  }

  // Generate deduplication recommendations
  const recommendations: DeduplicationRecommendation[] = [];

  // Check pairwise overlap between context files
  const processed = new Set<string>();
  for (const fileA of contextFiles) {
    for (const fileB of contextFiles) {
      if (fileA.path === fileB.path) continue;
      const pairKey = [fileA.path, fileB.path].sort().join("||");
      if (processed.has(pairKey)) continue;
      processed.add(pairKey);

      const dataA = contextSegmentMap.get(fileA.path);
      const dataB = contextSegmentMap.get(fileB.path);
      if (!dataA || !dataB) continue;

      const overlapAB = computePairwiseOverlap(dataA.raw, dataB.indexed);
      const overlapBA = computePairwiseOverlap(dataB.raw, dataA.indexed);
      const overlap = overlapAB.overlapPct >= overlapBA.overlapPct ? overlapAB : overlapBA;

      if (overlap.overlapPct >= MERGE_RECOMMENDATION_THRESHOLD) {
        // Determine which file has higher additionality
        const diffA = fileDiffs.find((d) => d.path === fileA.path);
        const diffB = fileDiffs.find((d) => d.path === fileB.path);
        const keepFile =
          (diffA?.additivePct ?? 0) >= (diffB?.additivePct ?? 0) ? fileA.path : fileB.path;
        const mergeFile = keepFile === fileA.path ? fileB.path : fileA.path;

        recommendations.push({
          action: "merge",
          description: `Merge ${mergeFile} into ${keepFile} — ${overlap.overlapPct.toFixed(1)}% content overlap. Keep vendor-specific overrides in ${mergeFile}, move shared content to ${keepFile}.`,
          files: [keepFile, mergeFile],
          overlapPct: overlap.overlapPct,
        });
      }
    }
  }

  // Check for sections in context files that duplicate repo docs
  for (const diff of fileDiffs) {
    const dupRepoSegments = diff.segments.filter((s) => s.classification === "duplicative-repo");
    if (dupRepoSegments.length >= 3) {
      const sources = [...new Set(dupRepoSegments.map((s) => s.matchedIn).filter(Boolean))];
      recommendations.push({
        action: "remove-section",
        description: `Remove duplicated content from ${diff.path} — ${dupRepoSegments.length} segments duplicate ${sources.join(", ")}. Agents can discover this information from the original sources.`,
        files: [diff.path, ...sources.filter((s): s is string => s !== undefined)],
        overlapPct: diff.duplicativeRepoPct,
      });
    }
  }

  return {
    files: fileDiffs,
    recommendations,
    totalFiles: contextFiles.length,
  };
}

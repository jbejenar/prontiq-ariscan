/**
 * Graph analysis algorithms: cycle detection, fan-in/fan-out, cohesion,
 * cross-boundary violations, and structural clarity scoring.
 */

import type {
  CohesionMetrics,
  CyclePath,
  DependencyGraph,
  FanMetrics,
  GraphMetrics,
} from "./types.js";

/**
 * Find all cycles (strongly connected components with >1 node) using Tarjan's algorithm.
 *
 * Returns cycles as ordered chains: [A, B, C] means A→B→C→A.
 */
export function findCycles(graph: DependencyGraph): CyclePath[] {
  const cycles: CyclePath[] = [];
  let index = 0;
  const nodeIndex = new Map<string, number>();
  const nodeLowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];

  function strongconnect(v: string): void {
    nodeIndex.set(v, index);
    nodeLowlink.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);

    const node = graph.nodes.get(v);
    if (node) {
      for (const w of node.imports) {
        // Only consider nodes that exist in the graph
        if (!graph.nodes.has(w)) continue;

        if (!nodeIndex.has(w)) {
          strongconnect(w);
          const vLow = nodeLowlink.get(v) ?? 0;
          const wLow = nodeLowlink.get(w) ?? 0;
          nodeLowlink.set(v, Math.min(vLow, wLow));
        } else if (onStack.has(w)) {
          const vLow = nodeLowlink.get(v) ?? 0;
          const wIdx = nodeIndex.get(w) ?? 0;
          nodeLowlink.set(v, Math.min(vLow, wIdx));
        }
      }
    }

    // If v is a root node, pop the SCC
    if (nodeLowlink.get(v) === nodeIndex.get(v)) {
      const component: string[] = [];
      let w: string | undefined;
      do {
        w = stack.pop();
        if (w === undefined) break;
        onStack.delete(w);
        component.push(w);
      } while (w !== v);

      // Only report SCCs with >1 node as cycles
      if (component.length > 1) {
        // Reverse to get a natural reading order (following import direction)
        component.reverse();
        cycles.push({ chain: component });
      }
    }
  }

  // Process all nodes
  for (const nodePath of graph.nodes.keys()) {
    if (!nodeIndex.has(nodePath)) {
      strongconnect(nodePath);
    }
  }

  return cycles;
}

/**
 * Compute fan-in (dependents) and fan-out (dependencies) for each module.
 */
export function computeFanMetrics(graph: DependencyGraph): FanMetrics[] {
  const metrics: FanMetrics[] = [];

  for (const [path, node] of graph.nodes) {
    // Only count edges to nodes that exist in the graph for accuracy
    let fanOut = 0;
    for (const imp of node.imports) {
      if (graph.nodes.has(imp)) fanOut++;
    }
    let fanIn = 0;
    for (const imp of node.importedBy) {
      if (graph.nodes.has(imp)) fanIn++;
    }

    metrics.push({ path, fanIn, fanOut });
  }

  return metrics.sort((a, b) => b.fanOut - a.fanOut);
}

/**
 * Compute cohesion per directory: ratio of internal to total dependencies.
 *
 * High cohesion means files within a directory mostly depend on each other.
 * Low cohesion means the directory's files mostly depend on external modules.
 */
export function computeCohesion(graph: DependencyGraph): CohesionMetrics[] {
  // Group modules by directory
  const dirModules = new Map<string, string[]>();
  for (const path of graph.nodes.keys()) {
    const parts = path.split("/");
    const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : ".";
    const list = dirModules.get(dir) ?? [];
    list.push(path);
    dirModules.set(dir, list);
  }

  const results: CohesionMetrics[] = [];

  for (const [directory, modules] of dirModules) {
    if (modules.length < 2) continue; // Skip single-file directories

    const moduleSet = new Set(modules);
    let internalDeps = 0;
    let externalDeps = 0;

    for (const modPath of modules) {
      const node = graph.nodes.get(modPath);
      if (!node) continue;

      for (const imp of node.imports) {
        if (!graph.nodes.has(imp)) continue; // Skip external packages
        if (moduleSet.has(imp)) {
          internalDeps++;
        } else {
          externalDeps++;
        }
      }
    }

    const total = internalDeps + externalDeps;
    const ratio = total > 0 ? internalDeps / total : 1;

    results.push({ directory, internalDeps, externalDeps, ratio });
  }

  return results.sort((a, b) => a.ratio - b.ratio);
}

/**
 * Compute an overall structural clarity score (0-100) from pre-computed metrics.
 *
 * Factors:
 * - Absence of cycles (major factor)
 * - Balanced fan-out (no extreme hubs)
 * - Good directory cohesion
 */
export function computeStructuralClarityFromResults(
  nodeCount: number,
  cycles: readonly CyclePath[],
  fanMetrics: readonly FanMetrics[],
  cohesion: readonly CohesionMetrics[],
): number {
  if (nodeCount === 0) return 50;

  let score = 100;

  // Cycle penalty: -15 per cycle, max -45
  score -= Math.min(45, cycles.length * 15);

  // Fan-out penalty: -5 for each module with fan-out > 15, max -20
  const highFanOut = fanMetrics.filter((m) => m.fanOut > 15).length;
  score -= Math.min(20, highFanOut * 5);

  // Cohesion penalty: -10 if average cohesion < 0.3, -5 if < 0.5
  if (cohesion.length > 0) {
    const avgCohesion = cohesion.reduce((sum, c) => sum + c.ratio, 0) / cohesion.length;
    if (avgCohesion < 0.3) {
      score -= 10;
    } else if (avgCohesion < 0.5) {
      score -= 5;
    }
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Convenience wrapper: compute structural clarity directly from a graph.
 * Runs all algorithms internally — prefer `computeStructuralClarityFromResults`
 * when you already have pre-computed metrics.
 */
export function computeStructuralClarity(graph: DependencyGraph): number {
  return computeStructuralClarityFromResults(
    graph.nodes.size,
    findCycles(graph),
    computeFanMetrics(graph),
    computeCohesion(graph),
  );
}

/**
 * Compute all graph metrics in a single pass.
 */
export function analyzeGraph(graph: DependencyGraph): GraphMetrics {
  const cycles = findCycles(graph);
  const fanMetrics = computeFanMetrics(graph);
  const cohesion = computeCohesion(graph);
  const structuralClarity = computeStructuralClarityFromResults(
    graph.nodes.size,
    cycles,
    fanMetrics,
    cohesion,
  );

  return {
    nodeCount: graph.nodes.size,
    edgeCount: graph.edgeCount,
    cycles,
    fanMetrics,
    cohesion,
    structuralClarity,
  };
}

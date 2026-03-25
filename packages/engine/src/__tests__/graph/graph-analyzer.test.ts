import { describe, it, expect } from "vitest";
import {
  findCycles,
  computeFanMetrics,
  computeCohesion,
  detectBoundaryViolations,
  computeStructuralClarity,
  analyzeGraph,
} from "../../graph/graph-analyzer.js";
import type { DependencyGraph, ModuleNode } from "../../graph/types.js";

/** Helper to build a DependencyGraph from an edge list. */
function buildGraph(edges: Record<string, string[]>): DependencyGraph {
  const nodes = new Map<string, ModuleNode>();
  let edgeCount = 0;

  // First pass: create all nodes with empty sets
  for (const [source, targets] of Object.entries(edges)) {
    if (!nodes.has(source)) {
      nodes.set(source, { path: source, imports: new Set(), importedBy: new Set() });
    }
    for (const target of targets) {
      if (!nodes.has(target)) {
        nodes.set(target, { path: target, imports: new Set(), importedBy: new Set() });
      }
    }
  }

  // Second pass: populate imports and importedBy (must cast to mutable)
  for (const [source, targets] of Object.entries(edges)) {
    const sourceNode = nodes.get(source) ?? {
      path: source,
      imports: new Set(),
      importedBy: new Set(),
    };
    for (const target of targets) {
      (sourceNode.imports as Set<string>).add(target);
      const targetNode = nodes.get(target) ?? {
        path: target,
        imports: new Set(),
        importedBy: new Set(),
      };
      (targetNode.importedBy as Set<string>).add(source);
      edgeCount++;
    }
  }

  return { nodes, edgeCount };
}

describe("findCycles (Tarjan's SCC)", () => {
  it("returns empty for acyclic graph", () => {
    const graph = buildGraph({
      "src/a": ["src/b"],
      "src/b": ["src/c"],
      "src/c": [],
    });
    const cycles = findCycles(graph);
    expect(cycles).toHaveLength(0);
  });

  it("detects a simple 2-node cycle", () => {
    const graph = buildGraph({
      "src/a": ["src/b"],
      "src/b": ["src/a"],
    });
    const cycles = findCycles(graph);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]?.chain).toHaveLength(2);
    expect(cycles[0]?.chain).toContain("src/a");
    expect(cycles[0]?.chain).toContain("src/b");
  });

  it("detects a 3-node cycle (A→B→C→A)", () => {
    const graph = buildGraph({
      "src/a": ["src/b"],
      "src/b": ["src/c"],
      "src/c": ["src/a"],
    });
    const cycles = findCycles(graph);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]?.chain).toHaveLength(3);
  });

  it("detects multiple independent cycles", () => {
    const graph = buildGraph({
      "src/a": ["src/b"],
      "src/b": ["src/a"],
      "lib/x": ["lib/y"],
      "lib/y": ["lib/x"],
    });
    const cycles = findCycles(graph);
    expect(cycles).toHaveLength(2);
  });

  it("does not treat a single node as a cycle", () => {
    const graph = buildGraph({
      "src/a": ["src/b"],
      "src/b": [],
    });
    const cycles = findCycles(graph);
    expect(cycles).toHaveLength(0);
  });

  it("handles graph with mixed cycle and non-cycle nodes", () => {
    const graph = buildGraph({
      "src/entry": ["src/a"],
      "src/a": ["src/b"],
      "src/b": ["src/a"],
      "src/a2": ["src/utils"],
      "src/utils": [],
    });
    const cycles = findCycles(graph);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]?.chain).toContain("src/a");
    expect(cycles[0]?.chain).toContain("src/b");
  });
});

describe("computeFanMetrics", () => {
  it("computes correct fan-in and fan-out", () => {
    const graph = buildGraph({
      "src/hub": ["src/a", "src/b", "src/c"],
      "src/a": [],
      "src/b": [],
      "src/c": [],
    });
    const metrics = computeFanMetrics(graph);
    const hub = metrics.find((m) => m.path === "src/hub");
    expect(hub?.fanOut).toBe(3);
    expect(hub?.fanIn).toBe(0);

    const leaf = metrics.find((m) => m.path === "src/a");
    expect(leaf?.fanIn).toBe(1);
    expect(leaf?.fanOut).toBe(0);
  });

  it("handles nodes with both fan-in and fan-out", () => {
    const graph = buildGraph({
      "src/a": ["src/b"],
      "src/b": ["src/c"],
      "src/c": [],
    });
    const metrics = computeFanMetrics(graph);
    const mid = metrics.find((m) => m.path === "src/b");
    expect(mid?.fanIn).toBe(1);
    expect(mid?.fanOut).toBe(1);
  });

  it("returns sorted by fan-out descending", () => {
    const graph = buildGraph({
      "src/big": ["src/a", "src/b", "src/c"],
      "src/small": ["src/a"],
      "src/a": [],
      "src/b": [],
      "src/c": [],
    });
    const metrics = computeFanMetrics(graph);
    expect(metrics[0]?.path).toBe("src/big");
  });
});

describe("computeCohesion", () => {
  it("computes high cohesion for internal-only deps", () => {
    const graph = buildGraph({
      "src/a": ["src/b"],
      "src/b": ["src/a"],
    });
    const cohesion = computeCohesion(graph);
    const srcCohesion = cohesion.find((c) => c.directory === "src");
    expect(srcCohesion?.ratio).toBe(1);
  });

  it("computes low cohesion for external-heavy deps", () => {
    const graph = buildGraph({
      "src/a": ["lib/x", "lib/y"],
      "src/b": ["lib/z"],
      "lib/x": [],
      "lib/y": [],
      "lib/z": [],
    });
    const cohesion = computeCohesion(graph);
    const srcCohesion = cohesion.find((c) => c.directory === "src");
    expect(srcCohesion).toBeDefined();
    expect(srcCohesion?.ratio).toBe(0); // all external
  });

  it("skips single-file directories", () => {
    const graph = buildGraph({
      "single/only": ["other/file"],
      "other/file": [],
    });
    const cohesion = computeCohesion(graph);
    // Both directories have only one file
    expect(cohesion).toHaveLength(0);
  });
});

describe("detectBoundaryViolations", () => {
  it("detects production code importing test files", () => {
    const graph = buildGraph({
      "src/service": ["src/__tests__/helper"],
      "src/__tests__/helper": [],
    });
    const violations = detectBoundaryViolations(graph);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]?.rule).toContain("test");
  });

  it("does not flag normal imports", () => {
    const graph = buildGraph({
      "src/a": ["src/b"],
      "src/b": [],
    });
    const violations = detectBoundaryViolations(graph);
    expect(violations).toHaveLength(0);
  });
});

describe("computeStructuralClarity", () => {
  it("returns 100 for clean graph with no issues", () => {
    const graph = buildGraph({
      "src/a": ["src/b"],
      "src/b": ["src/c"],
      "src/c": [],
    });
    const score = computeStructuralClarity(graph);
    expect(score).toBe(100);
  });

  it("penalizes cycles", () => {
    const graph = buildGraph({
      "src/a": ["src/b"],
      "src/b": ["src/a"],
    });
    const score = computeStructuralClarity(graph);
    expect(score).toBeLessThan(100);
  });

  it("returns 50 for empty graph", () => {
    const graph: DependencyGraph = { nodes: new Map(), edgeCount: 0 };
    const score = computeStructuralClarity(graph);
    expect(score).toBe(50);
  });

  it("is clamped to [0, 100]", () => {
    // Create a graph with many issues
    const graph = buildGraph({
      "src/a": ["src/b"],
      "src/b": ["src/c"],
      "src/c": ["src/a"], // cycle
      "src/__tests__/test": [],
      "src/prod": ["src/__tests__/test"], // boundary violation
    });
    const score = computeStructuralClarity(graph);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("analyzeGraph", () => {
  it("returns complete metrics object", () => {
    const graph = buildGraph({
      "src/a": ["src/b"],
      "src/b": ["src/c"],
      "src/c": [],
    });
    const metrics = analyzeGraph(graph);

    expect(metrics.nodeCount).toBe(3);
    expect(metrics.edgeCount).toBe(2);
    expect(metrics.cycles).toHaveLength(0);
    expect(metrics.fanMetrics).toHaveLength(3);
    expect(metrics.structuralClarity).toBe(100);
  });
});

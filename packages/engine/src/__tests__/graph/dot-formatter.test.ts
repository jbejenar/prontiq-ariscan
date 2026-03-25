import { describe, it, expect } from "vitest";
import { generateDotGraph } from "../../graph/dot-formatter.js";
import type { DependencyGraph, ModuleNode, CyclePath } from "../../graph/types.js";

/** Helper to build a DependencyGraph from an edge list. */
function buildGraph(edges: Record<string, string[]>): DependencyGraph {
  const nodes = new Map<string, ModuleNode>();
  let edgeCount = 0;

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

describe("generateDotGraph", () => {
  it("generates valid DOT for a simple graph", () => {
    const graph = buildGraph({
      "src/a": ["src/b"],
      "src/b": [],
    });
    const dot = generateDotGraph(graph);

    expect(dot).toContain("digraph");
    expect(dot).toContain('"src/a" -> "src/b"');
    expect(dot).toContain("}");
  });

  it("highlights cycle edges in red", () => {
    const graph = buildGraph({
      "src/a": ["src/b"],
      "src/b": ["src/a"],
    });
    const cycles: CyclePath[] = [{ chain: ["src/a", "src/b"] }];
    const dot = generateDotGraph(graph, cycles, { highlightCycles: true });

    expect(dot).toContain('color="red"');
  });

  it("groups nodes by directory when clustering enabled", () => {
    const graph = buildGraph({
      "src/a": ["lib/b"],
      "lib/b": [],
    });
    const dot = generateDotGraph(graph, [], { clusterByDirectory: true });

    expect(dot).toContain("subgraph cluster_");
    expect(dot).toContain('label="src"');
    expect(dot).toContain('label="lib"');
  });

  it("uses custom title", () => {
    const graph = buildGraph({ "src/a": [] });
    const dot = generateDotGraph(graph, [], { title: "My Graph" });

    expect(dot).toContain('"My Graph"');
  });

  it("generates valid DOT for empty graph", () => {
    const graph: DependencyGraph = { nodes: new Map(), edgeCount: 0 };
    const dot = generateDotGraph(graph);

    expect(dot).toContain("digraph");
    expect(dot).toContain("}");
  });
});

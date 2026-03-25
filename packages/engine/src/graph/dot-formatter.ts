/**
 * Generate DOT format output for dependency graph visualization with graphviz.
 *
 * Usage: pipe output to `dot -Tsvg` or `dot -Tpng` for rendering.
 */

import type { CyclePath, DependencyGraph } from "./types.js";

/** Options for DOT output generation. */
export interface DotFormatOptions {
  /** Highlight cycle edges in red (default: true) */
  highlightCycles?: boolean;
  /** Group nodes by directory (default: true) */
  clusterByDirectory?: boolean;
  /** Title for the graph */
  title?: string;
}

/**
 * Generate a DOT format string for the dependency graph.
 */
export function generateDotGraph(
  graph: DependencyGraph,
  cycles: readonly CyclePath[] = [],
  options: DotFormatOptions = {},
): string {
  const { highlightCycles = true, clusterByDirectory = true, title = "Dependency Graph" } = options;

  // Build a set of cycle edges for highlighting
  const cycleEdges = new Set<string>();
  if (highlightCycles) {
    for (const cycle of cycles) {
      for (let i = 0; i < cycle.chain.length; i++) {
        const from = cycle.chain[i];
        const to = cycle.chain[(i + 1) % cycle.chain.length];
        if (from && to) {
          cycleEdges.add(`${from}->${to}`);
        }
      }
    }
  }

  const lines: string[] = [];
  lines.push(`digraph "${title}" {`);
  lines.push("  rankdir=LR;");
  lines.push('  node [shape=box, style=filled, fillcolor="#e8f4f8", fontsize=10];');
  lines.push('  edge [color="#666666"];');
  lines.push("");

  if (clusterByDirectory) {
    // Group nodes by directory
    const dirNodes = new Map<string, string[]>();
    for (const path of graph.nodes.keys()) {
      const parts = path.split("/");
      const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : ".";
      const list = dirNodes.get(dir) ?? [];
      list.push(path);
      dirNodes.set(dir, list);
    }

    let clusterIdx = 0;
    for (const [dir, nodes] of dirNodes) {
      lines.push(`  subgraph cluster_${clusterIdx} {`);
      lines.push(`    label="${dir}";`);
      lines.push("    style=dashed;");
      lines.push('    color="#999999";');
      for (const nodePath of nodes) {
        const label = nodePath.split("/").pop() ?? nodePath;
        lines.push(`    "${nodePath}" [label="${label}"];`);
      }
      lines.push("  }");
      lines.push("");
      clusterIdx++;
    }
  } else {
    // Flat node declarations
    for (const path of graph.nodes.keys()) {
      const label = path.split("/").pop() ?? path;
      lines.push(`  "${path}" [label="${label}"];`);
    }
    lines.push("");
  }

  // Edges
  for (const [sourcePath, node] of graph.nodes) {
    for (const targetPath of node.imports) {
      if (!graph.nodes.has(targetPath)) continue; // Skip external
      const edgeKey = `${sourcePath}->${targetPath}`;
      const isCycleEdge = cycleEdges.has(edgeKey);
      const attrs = isCycleEdge ? ' [color="red", penwidth=2]' : "";
      lines.push(`  "${sourcePath}" -> "${targetPath}"${attrs};`);
    }
  }

  lines.push("}");
  return lines.join("\n");
}

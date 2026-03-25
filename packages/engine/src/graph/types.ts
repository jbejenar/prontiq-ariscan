/**
 * Types for dependency graph analysis.
 *
 * Used by the P7 navigability analyzer for AST/graph-based analysis:
 * cycle detection, fan-in/fan-out, cohesion, and cross-boundary violations.
 */

/** A single import extracted from a source file. */
export interface ImportInfo {
  /** File that contains the import statement */
  readonly sourceFile: string;
  /** Resolved target module path (relative, without extension) */
  readonly target: string;
  /** Whether this is a relative import (./foo) or a package import (lodash) */
  readonly kind: "relative" | "package";
}

/** A node in the dependency graph representing a source module. */
export interface ModuleNode {
  /** Normalized file path (relative to repo root, without extension) */
  readonly path: string;
  /** Modules this module imports (outgoing edges) */
  readonly imports: ReadonlySet<string>;
  /** Modules that import this module (incoming edges) */
  readonly importedBy: ReadonlySet<string>;
}

/** The full dependency graph for a codebase. */
export interface DependencyGraph {
  /** All modules indexed by normalized path */
  readonly nodes: ReadonlyMap<string, ModuleNode>;
  /** Total number of edges (import relationships) */
  readonly edgeCount: number;
}

/** A cycle (strongly connected component with >1 node, or self-loop). */
export interface CyclePath {
  /** Ordered list of module paths forming the cycle (last→first closes the loop) */
  readonly chain: readonly string[];
}

/** Fan-in/fan-out metrics for a single module. */
export interface FanMetrics {
  readonly path: string;
  /** Number of modules that import this one */
  readonly fanIn: number;
  /** Number of modules this one imports */
  readonly fanOut: number;
}

/** Cohesion metrics for a directory/module boundary. */
export interface CohesionMetrics {
  /** Directory path */
  readonly directory: string;
  /** Number of imports between files within this directory */
  readonly internalDeps: number;
  /** Number of imports from files in this directory to outside */
  readonly externalDeps: number;
  /** Cohesion ratio: internal / (internal + external), 0-1 */
  readonly ratio: number;
}

/** Aggregate graph metrics. */
export interface GraphMetrics {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly cycles: readonly CyclePath[];
  readonly fanMetrics: readonly FanMetrics[];
  readonly cohesion: readonly CohesionMetrics[];
  /** Overall structural clarity score (0-100) */
  readonly structuralClarity: number;
}

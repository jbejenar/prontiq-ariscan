import type { PluginManifest, PluginFinding } from "@prontiq/ariscan-schema";
import type { RepoContext } from "../analyzers/analyzer.interface.js";

/**
 * Interface that plugins must implement.
 * Mirrors PillarAnalyzer but with plugin-specific metadata.
 */
export interface AriscanPlugin {
  /** Plugin manifest with metadata. */
  readonly manifest: PluginManifest;
  /** Run the plugin's analysis on a repository. */
  analyze(context: RepoContext): Promise<PluginAnalyzeResult>;
}

/** Raw result from a plugin's analyze function (before source attribution). */
export interface PluginAnalyzeResult {
  /** Findings produced by the plugin (without source field — added by runner). */
  findings: Array<Omit<PluginFinding, "source">>;
  /** Optional summary. */
  summary?: string;
}

/** A plugin that has been loaded and validated. */
export interface LoadedPlugin {
  /** Resolved plugin instance. */
  plugin: AriscanPlugin;
  /** Where the plugin was loaded from. */
  source: "local" | "npm";
  /** File path or package name. */
  location: string;
}

/** Result from running all plugins. */
export interface PluginRunResult {
  /** All findings from all plugins, with source attribution. */
  findings: PluginFinding[];
  /** Per-plugin summaries. */
  summaries: Array<{ pluginName: string; summary: string }>;
  /** Errors from plugins that failed. */
  errors: Array<{ pluginName: string; error: string }>;
}

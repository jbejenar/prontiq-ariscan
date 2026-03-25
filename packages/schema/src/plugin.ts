import { z } from "zod";
import { PillarId } from "./pillar.js";
import { Confidence, Finding } from "./scan-result.js";

/** Current plugin API version. Plugins must declare compatibility. */
export const PLUGIN_API_VERSION = "1.0" as const;

/** Metadata describing a plugin. */
export const PluginManifest = z.object({
  /** Unique plugin name (npm convention: ariscan-plugin-*). */
  name: z.string().min(1),
  /** Plugin version (semver). */
  version: z.string().min(1),
  /** Plugin author or organization. */
  author: z.string().optional(),
  /** Short description of what this plugin checks. */
  description: z.string().optional(),
  /** Plugin API version this plugin targets. */
  apiVersion: z.string().default(PLUGIN_API_VERSION),
  /** Which pillar this plugin contributes findings to (optional — plugins can target any pillar). */
  pillar: PillarId.optional(),
  /** Confidence level of the plugin's analysis. */
  confidence: Confidence.optional(),
});
export type PluginManifest = z.infer<typeof PluginManifest>;

/** Result returned by a plugin, wrapping PillarResult with source attribution. */
export const PluginFinding = Finding.extend({
  /** Source attribution: "plugin:<name>". */
  source: z.string(),
});
export type PluginFinding = z.infer<typeof PluginFinding>;

/** Result from running a plugin's analyze function. */
export const PluginAnalysisResult = z.object({
  /** Findings produced by the plugin. */
  findings: z.array(PluginFinding),
  /** Optional summary from the plugin. */
  summary: z.string().optional(),
});
export type PluginAnalysisResult = z.infer<typeof PluginAnalysisResult>;

/** Plugin configuration in ariscan.yml. */
export const PluginConfig = z.object({
  /** Directory to load local plugins from (default: .ariscan/plugins). */
  directory: z.string().optional(),
  /** npm package names to load as plugins. */
  packages: z.array(z.string()).optional(),
  /** Enable or disable plugin loading entirely. */
  enabled: z.boolean().default(true),
});
export type PluginConfig = z.infer<typeof PluginConfig>;

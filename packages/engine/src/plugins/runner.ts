import type { PluginFinding } from "@prontiq/ariscan-schema";
import type { RepoContext } from "../analyzers/analyzer.interface.js";
import type { LoadedPlugin, PluginRunResult } from "./types.js";

/** Default timeout per plugin in milliseconds. */
const DEFAULT_PLUGIN_TIMEOUT_MS = 30_000;

/**
 * Run all loaded plugins against a repository context.
 *
 * Each plugin runs in isolation — if one fails, others still execute.
 * Plugin results are attributed with `source: "plugin:<name>"`.
 */
export async function runPlugins(
  plugins: LoadedPlugin[],
  context: RepoContext,
  timeoutMs: number = DEFAULT_PLUGIN_TIMEOUT_MS,
): Promise<PluginRunResult> {
  const allFindings: PluginFinding[] = [];
  const summaries: PluginRunResult["summaries"] = [];
  const errors: PluginRunResult["errors"] = [];

  // Run plugins sequentially to avoid resource contention
  for (const { plugin } of plugins) {
    const pluginName = plugin.manifest.name;

    try {
      const result = await runWithTimeout(
        () => plugin.analyze(context),
        timeoutMs,
        `Plugin "${pluginName}" timed out after ${timeoutMs}ms`,
      );

      // Attribute findings to this plugin
      const attributed: PluginFinding[] = result.findings.map((f) => ({
        ...f,
        source: `plugin:${pluginName}`,
      }));

      allFindings.push(...attributed);

      if (result.summary) {
        summaries.push({ pluginName, summary: result.summary });
      }
    } catch (err) {
      errors.push({
        pluginName,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { findings: allFindings, summaries, errors };
}

/** Run an async function with a timeout. */
async function runWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    fn()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

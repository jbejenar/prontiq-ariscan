import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PluginManifest, PLUGIN_API_VERSION } from "@prontiq/ariscan-schema";
import type { LoadedPlugin, AriscanPlugin } from "./types.js";

/** Default directory for local plugins relative to repo root. */
const DEFAULT_PLUGIN_DIR = ".ariscan/plugins";

/**
 * Discover and load plugins from local directory and/or npm packages.
 *
 * Plugin discovery:
 * - Local: each subdirectory (or .ts/.js file) in the plugin directory
 * - npm: packages matching the provided names in node_modules
 *
 * @param repoPath — absolute path to the repository root
 * @param options — plugin directory and package names
 */
export async function loadPlugins(
  repoPath: string,
  options: { directory?: string; packages?: string[] } = {},
): Promise<{ plugins: LoadedPlugin[]; errors: Array<{ location: string; error: string }> }> {
  const plugins: LoadedPlugin[] = [];
  const errors: Array<{ location: string; error: string }> = [];

  // Load local plugins
  const pluginDir = resolve(repoPath, options.directory ?? DEFAULT_PLUGIN_DIR);
  const localPlugins = await loadLocalPlugins(pluginDir);
  plugins.push(...localPlugins.plugins);
  errors.push(...localPlugins.errors);

  // Load npm plugins
  if (options.packages?.length) {
    const npmPlugins = await loadNpmPlugins(repoPath, options.packages);
    plugins.push(...npmPlugins.plugins);
    errors.push(...npmPlugins.errors);
  }

  // Deduplicate by plugin name (first one wins)
  const seen = new Set<string>();
  const deduped: LoadedPlugin[] = [];
  for (const lp of plugins) {
    if (!seen.has(lp.plugin.manifest.name)) {
      seen.add(lp.plugin.manifest.name);
      deduped.push(lp);
    }
  }

  return { plugins: deduped, errors };
}

/** Load plugins from a local directory. */
async function loadLocalPlugins(
  pluginDir: string,
): Promise<{ plugins: LoadedPlugin[]; errors: Array<{ location: string; error: string }> }> {
  const plugins: LoadedPlugin[] = [];
  const errors: Array<{ location: string; error: string }> = [];

  try {
    const entries = await readdir(pluginDir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = join(pluginDir, entry.name);

      try {
        let modulePath: string;

        if (entry.isDirectory()) {
          // Look for index.js or index.ts in subdirectory
          const indexJs = join(entryPath, "index.js");
          const indexTs = join(entryPath, "index.ts");
          const hasJs = await fileExistsSafe(indexJs);
          modulePath = hasJs ? indexJs : indexTs;

          if (!hasJs && !(await fileExistsSafe(indexTs))) {
            continue; // Skip directories without index file
          }
        } else if (entry.name.endsWith(".js") || entry.name.endsWith(".ts")) {
          modulePath = entryPath;
        } else {
          continue; // Skip non-JS/TS files
        }

        const plugin = await loadPluginModule(modulePath);
        validatePluginApi(plugin);
        plugins.push({ plugin, source: "local", location: entryPath });
      } catch (err) {
        errors.push({
          location: entryPath,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch {
    // Plugin directory doesn't exist — not an error, just no plugins
  }

  return { plugins, errors };
}

/** Load plugins from npm packages. */
async function loadNpmPlugins(
  repoPath: string,
  packageNames: string[],
): Promise<{ plugins: LoadedPlugin[]; errors: Array<{ location: string; error: string }> }> {
  const plugins: LoadedPlugin[] = [];
  const errors: Array<{ location: string; error: string }> = [];

  for (const pkgName of packageNames) {
    try {
      // Try to resolve the package from repo's node_modules
      const pkgPath = join(repoPath, "node_modules", pkgName);
      const pkgExists = await fileExistsSafe(join(pkgPath, "package.json"));

      if (!pkgExists) {
        errors.push({ location: pkgName, error: `Package "${pkgName}" not found in node_modules` });
        continue;
      }

      // Import the package using dynamic import
      const moduleUrl = pathToFileURL(join(pkgPath, "index.js")).href;
      const plugin = await loadPluginModule(moduleUrl);
      validatePluginApi(plugin);
      plugins.push({ plugin, source: "npm", location: pkgName });
    } catch (err) {
      errors.push({
        location: pkgName,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { plugins, errors };
}

/** Dynamically import a module and extract the plugin export. */
async function loadPluginModule(modulePath: string): Promise<AriscanPlugin> {
  const moduleUrl = modulePath.startsWith("file://") ? modulePath : pathToFileURL(modulePath).href;
  const mod: Record<string, unknown> = (await import(moduleUrl)) as Record<string, unknown>;

  // Convention: default export or named `plugin` export
  const pluginObj = mod.default ?? mod.plugin;

  if (!pluginObj || typeof pluginObj !== "object") {
    throw new Error(
      "Plugin module must export a default or named 'plugin' object implementing AriscanPlugin",
    );
  }

  return pluginObj as AriscanPlugin;
}

/** Validate that a loaded plugin conforms to the API contract. */
function validatePluginApi(plugin: AriscanPlugin): void {
  // Validate manifest
  if (!plugin.manifest || typeof plugin.manifest !== "object") {
    throw new Error("Plugin must have a 'manifest' property");
  }

  const parsed = PluginManifest.safeParse(plugin.manifest);
  if (!parsed.success) {
    throw new Error(`Invalid plugin manifest: ${parsed.error.message}`);
  }

  // Check API version compatibility
  const [pluginMajor] = parsed.data.apiVersion.split(".");
  const [currentMajor] = PLUGIN_API_VERSION.split(".");
  if (pluginMajor !== currentMajor) {
    throw new Error(
      `Plugin API version mismatch: plugin targets ${parsed.data.apiVersion}, current is ${PLUGIN_API_VERSION}`,
    );
  }

  // Validate analyze function
  if (typeof plugin.analyze !== "function") {
    throw new Error("Plugin must have an 'analyze' function");
  }
}

async function fileExistsSafe(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

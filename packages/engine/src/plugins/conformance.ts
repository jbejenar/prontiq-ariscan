import { PluginManifest, PLUGIN_API_VERSION, Finding } from "@prontiq/ariscan-schema";
import type { AriscanPlugin } from "./types.js";
import type { RepoContext } from "../analyzers/analyzer.interface.js";

/** Conformance test result for a single check. */
export interface ConformanceCheck {
  name: string;
  passed: boolean;
  message: string;
}

/** Full conformance test result. */
export interface ConformanceResult {
  pluginName: string;
  passed: boolean;
  checks: ConformanceCheck[];
}

/**
 * Validate a plugin against the conformance suite.
 *
 * Checks:
 * 1. Manifest is valid per PluginManifest schema
 * 2. API version is compatible
 * 3. analyze() is a function
 * 4. analyze() returns valid findings on an empty context
 * 5. analyze() completes within timeout
 * 6. analyze() doesn't throw on empty context
 */
export async function validatePlugin(
  plugin: AriscanPlugin,
  timeoutMs: number = 10_000,
): Promise<ConformanceResult> {
  const checks: ConformanceCheck[] = [];
  const pluginName = plugin.manifest?.name ?? "unknown";

  // Check 1: manifest is valid
  const manifestResult = PluginManifest.safeParse(plugin.manifest);
  checks.push({
    name: "valid-manifest",
    passed: manifestResult.success,
    message: manifestResult.success
      ? "Manifest validates against PluginManifest schema"
      : `Invalid manifest: ${manifestResult.error.message}`,
  });

  // Check 2: API version compatible
  const apiVersion = plugin.manifest?.apiVersion ?? "0.0";
  const [pluginMajor] = apiVersion.split(".");
  const [currentMajor] = PLUGIN_API_VERSION.split(".");
  const apiCompatible = pluginMajor === currentMajor;
  checks.push({
    name: "api-version-compatible",
    passed: apiCompatible,
    message: apiCompatible
      ? `API version ${apiVersion} is compatible with ${PLUGIN_API_VERSION}`
      : `API version ${apiVersion} is not compatible with ${PLUGIN_API_VERSION}`,
  });

  // Check 3: analyze is a function
  const hasAnalyze = typeof plugin.analyze === "function";
  checks.push({
    name: "has-analyze-function",
    passed: hasAnalyze,
    message: hasAnalyze ? "Plugin has analyze() function" : "Plugin missing analyze() function",
  });

  if (!hasAnalyze) {
    return { pluginName, passed: false, checks };
  }

  // Check 4-6: run analyze on empty context
  const emptyContext = createEmptyContext();
  try {
    const result = await runWithConformanceTimeout(() => plugin.analyze(emptyContext), timeoutMs);

    // Check 4: returns valid findings
    const findingsValid = Array.isArray(result.findings);
    checks.push({
      name: "returns-valid-findings",
      passed: findingsValid,
      message: findingsValid
        ? `Returned ${result.findings.length} finding(s)`
        : "analyze() did not return an array of findings",
    });

    if (findingsValid && result.findings.length > 0) {
      // Validate each finding against the Finding schema (without source — source is added by runner)
      let allFindingsValid = true;
      for (const f of result.findings) {
        const findingResult = Finding.safeParse(f);
        if (!findingResult.success) {
          allFindingsValid = false;
          checks.push({
            name: "finding-schema-valid",
            passed: false,
            message: `Finding validation failed: ${findingResult.error.message}`,
          });
          break;
        }
      }
      if (allFindingsValid) {
        checks.push({
          name: "finding-schema-valid",
          passed: true,
          message: "All findings validate against Finding schema",
        });
      }
    } else {
      checks.push({
        name: "finding-schema-valid",
        passed: true,
        message: "No findings to validate (acceptable for empty context)",
      });
    }

    // Check 5: completed within timeout
    checks.push({
      name: "completes-within-timeout",
      passed: true,
      message: `Completed within ${timeoutMs}ms`,
    });

    // Check 6: didn't throw
    checks.push({
      name: "no-throw-on-empty",
      passed: true,
      message: "Did not throw on empty context",
    });
  } catch (err) {
    const isTimeout = err instanceof Error && err.message.includes("timed out");
    checks.push({
      name: "completes-within-timeout",
      passed: !isTimeout,
      message: isTimeout ? `Timed out after ${timeoutMs}ms` : "Completed (but with error)",
    });
    checks.push({
      name: "no-throw-on-empty",
      passed: false,
      message: `Threw error: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  const passed = checks.every((c) => c.passed);
  return { pluginName, passed, checks };
}

/** Create a minimal empty RepoContext for conformance testing. */
function createEmptyContext(): RepoContext {
  return {
    rootPath: "/tmp/ariscan-conformance",
    files: [],
    readFile: async () => null,
    fileExists: async () => false,
    readJson: async () => null,
  };
}

async function runWithConformanceTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Plugin timed out after ${timeoutMs}ms`));
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

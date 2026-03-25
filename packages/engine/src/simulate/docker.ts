/**
 * Docker and devcontainer detection for simulation (P3.05).
 *
 * Detects available isolation modes and configures Docker execution.
 */
import { access } from "node:fs/promises";
import { join } from "node:path";
import type { IsolationMode } from "@prontiq/ariscan-schema";
import { NativeExecutor } from "./runner.js";

/** Check if Docker is available on the system. */
export async function isDockerAvailable(): Promise<boolean> {
  const executor = new NativeExecutor();
  const result = await executor.execute({
    id: "clone",
    command: "docker info",
    cwd: process.cwd(),
    timeoutMs: 10_000,
  });
  return result.status === "pass";
}

/** Check if a devcontainer.json exists in the repo. */
export async function hasDevcontainer(repoPath: string): Promise<boolean> {
  try {
    await access(join(repoPath, ".devcontainer", "devcontainer.json"));
    return true;
  } catch {
    try {
      await access(join(repoPath, ".devcontainer.json"));
      return true;
    } catch {
      return false;
    }
  }
}

/** Read the Docker image from devcontainer.json if available. */
export async function getDevcontainerImage(repoPath: string): Promise<string | null> {
  const { readFile } = await import("node:fs/promises");

  const paths = [
    join(repoPath, ".devcontainer", "devcontainer.json"),
    join(repoPath, ".devcontainer.json"),
  ];

  for (const configPath of paths) {
    try {
      const raw = await readFile(configPath, "utf-8");
      // devcontainer.json may have comments — strip them
      const cleaned = raw.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      const config = JSON.parse(cleaned) as { image?: string };
      if (config.image) return config.image;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Determine the best isolation mode for the simulation.
 *
 * Priority:
 * 1. Explicit override from user
 * 2. Devcontainer (if devcontainer.json exists and Docker is available)
 * 3. Docker (if available)
 * 4. Native (fallback)
 */
export async function resolveIsolationMode(
  repoPath: string,
  override?: IsolationMode,
): Promise<{
  mode: IsolationMode;
  dockerImage: string | null;
  devcontainerDetected: boolean;
}> {
  const devcontainerDetected = await hasDevcontainer(repoPath);

  if (override) {
    if (override === "docker" || override === "devcontainer") {
      const dockerAvailable = await isDockerAvailable();
      if (!dockerAvailable) {
        throw new Error(
          `Isolation mode '${override}' requires Docker, but Docker is not available. ` +
            "Install Docker or use --isolation native.",
        );
      }
    }

    const dockerImage =
      override === "devcontainer"
        ? ((await getDevcontainerImage(repoPath)) ??
          "mcr.microsoft.com/devcontainers/typescript-node:22")
        : override === "docker"
          ? "node:22-slim"
          : null;

    return { mode: override, dockerImage, devcontainerDetected };
  }

  // Auto-detect
  const dockerAvailable = await isDockerAvailable();

  if (devcontainerDetected && dockerAvailable) {
    const image =
      (await getDevcontainerImage(repoPath)) ??
      "mcr.microsoft.com/devcontainers/typescript-node:22";
    return { mode: "devcontainer", dockerImage: image, devcontainerDetected };
  }

  if (dockerAvailable) {
    return {
      mode: "docker",
      dockerImage: "node:22-slim",
      devcontainerDetected,
    };
  }

  return { mode: "native", dockerImage: null, devcontainerDetected };
}

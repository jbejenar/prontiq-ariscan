/**
 * ariscan-plugin-terraform — Reference plugin for Prontiq ARI
 *
 * Demonstrates the AriscanPlugin interface by checking for Terraform
 * best practices related to agent readiness.
 *
 * Usage:
 *   1. Copy this directory to `.ariscan/plugins/terraform/` in your repo
 *   2. Run `ariscan .` — plugin findings will appear under "plugin:ariscan-plugin-terraform"
 *
 * Or install as npm package (when published):
 *   1. `npm install ariscan-plugin-terraform`
 *   2. Add to `.ariscan.yml`: `plugins: { packages: ["ariscan-plugin-terraform"] }`
 */

/** @type {import('@prontiq/ariscan-engine').AriscanPlugin} */
export default {
  manifest: {
    name: "ariscan-plugin-terraform",
    version: "0.1.0",
    apiVersion: "1.0",
    author: "Prontiq",
    description: "Checks Terraform projects for agent readiness best practices",
    pillar: "P6",
    confidence: "medium",
  },

  async analyze(context) {
    const findings = [];

    // Check for .terraform.lock.hcl
    const hasLockFile = await context.fileExists(".terraform.lock.hcl");
    if (!hasLockFile) {
      // Only flag if this is a Terraform project
      const hasTfFiles = context.files.some((f) => f.endsWith(".tf"));
      if (hasTfFiles) {
        findings.push({
          code: "ARI-BLD-901",
          severity: "medium",
          pillar: "P6",
          message:
            "No .terraform.lock.hcl found — provider versions are not pinned, which breaks build determinism",
          confidence: "high",
          remediation: {
            action: "configure-tool",
            description:
              "Run `terraform init` to generate .terraform.lock.hcl and commit it to version control",
            confidence: "high",
          },
        });
      }
    }

    // Check for backend configuration
    const tfFiles = context.files.filter((f) => f.endsWith(".tf"));
    let hasBackendConfig = false;

    for (const tf of tfFiles.slice(0, 20)) {
      const content = await context.readFile(tf);
      if (content && /backend\s+"/.test(content)) {
        hasBackendConfig = true;
        break;
      }
    }

    if (tfFiles.length > 0 && !hasBackendConfig) {
      findings.push({
        code: "ARI-BLD-902",
        severity: "low",
        pillar: "P6",
        message:
          "No Terraform backend configuration found — state is stored locally, which blocks team and agent collaboration",
        confidence: "medium",
        remediation: {
          action: "modify-config",
          description:
            "Configure a remote backend (S3, GCS, Azure, or Terraform Cloud) for shared state management",
          confidence: "medium",
        },
      });
    }

    // Check for terraform-docs or README in modules
    const moduleReadmes = context.files.filter(
      (f) => f.includes("modules/") && f.endsWith("README.md"),
    );
    const moduleDirs = new Set(
      context.files
        .filter((f) => f.includes("modules/") && f.endsWith(".tf"))
        .map((f) => f.split("/").slice(0, -1).join("/")),
    );

    if (moduleDirs.size > 0 && moduleReadmes.length === 0) {
      findings.push({
        code: "ARI-DOC-901",
        severity: "low",
        pillar: "P5",
        message: `Found ${moduleDirs.size} Terraform module(s) without documentation — agents need module docs to understand inputs, outputs, and usage`,
        confidence: "medium",
        remediation: {
          action: "create-file",
          description:
            "Add README.md to each module directory, or use terraform-docs to auto-generate documentation",
          confidence: "medium",
        },
      });
    }

    return {
      findings,
      summary:
        tfFiles.length > 0
          ? `Scanned ${tfFiles.length} Terraform file(s), found ${findings.length} issue(s)`
          : "No Terraform files detected — skipping",
    };
  },
};

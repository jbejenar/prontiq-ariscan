/**
 * Init subcommand (S.01) — Project scaffolder.
 *
 * Interactive: `ariscan init`
 * Non-interactive (S.10): `ariscan init --preset bare --name my-app`
 */
import { defineCommand } from "citty";
import { resolve } from "node:path";
import { scaffold } from "../scaffolder/engine.js";
import { listPresets, getPreset } from "../scaffolder/presets/index.js";
import { promptProjectName, promptPreset, validateProjectName } from "../scaffolder/prompts.js";

export const initCommand = defineCommand({
  meta: {
    name: "init",
    description: `Scaffold a new agent-ready project

Examples:
  ariscan init                              # Interactive mode
  ariscan init --preset bare --name my-app  # Non-interactive mode
  ariscan init ./my-app                     # Specify output directory`,
  },
  args: {
    path: {
      type: "positional",
      description: "Output directory (default: ./<project-name>)",
      required: false,
    },
    preset: {
      type: "string",
      description: "Preset to use (e.g., bare)",
      required: false,
    },
    name: {
      type: "string",
      description: "Project name",
      required: false,
    },
  },
  async run({ args }) {
    const presetArg = args.preset as string | undefined;
    const nameArg = args.name as string | undefined;
    const pathArg = args.path as string | undefined;

    const isNonInteractive = Boolean(presetArg && nameArg);
    const isTTY = Boolean(process.stdin.isTTY);

    // Non-TTY without required flags → error with guidance
    if (!isTTY && !isNonInteractive) {
      process.stderr.write(
        "Error: Interactive mode requires a TTY.\n" +
          "Use: ariscan init --preset bare --name my-app\n",
      );
      process.exit(2);
    }

    // Resolve name
    let projectName: string;
    if (nameArg) {
      const err = validateProjectName(nameArg);
      if (err) {
        process.stderr.write(`Error: ${err}\n`);
        process.exit(2);
      }
      projectName = nameArg;
    } else {
      projectName = await promptProjectName();
    }

    // Resolve preset
    let presetId: string;
    if (presetArg) {
      if (!getPreset(presetArg)) {
        const available = listPresets()
          .map((p) => p.manifest.id)
          .join(", ");
        process.stderr.write(`Error: Unknown preset "${presetArg}". Available: ${available}\n`);
        process.exit(2);
      }
      presetId = presetArg;
    } else {
      presetId = await promptPreset(listPresets());
    }

    // Resolve output directory
    const outputDir = resolve(pathArg ?? `./${projectName}`);

    process.stderr.write(`\nScaffolding ${projectName} with preset "${presetId}"...\n`);

    try {
      const result = await scaffold({
        name: projectName,
        preset: presetId,
        outputDir,
      });

      process.stderr.write(`\nCreated ${result.filesWritten} files in ${result.outputDir}\n\n`);
      process.stderr.write("Next steps:\n");
      process.stderr.write(`  cd ${projectName}\n`);
      process.stderr.write("  npm install\n");
      process.stderr.write("  npm test\n\n");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${message}\n`);
      process.exit(1);
    }
  },
});

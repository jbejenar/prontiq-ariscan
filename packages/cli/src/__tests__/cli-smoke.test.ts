import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliBin = resolve(__dirname, "../../dist/cli.js");

describe("CLI smoke test", () => {
  it("prints help when invoked with --help", () => {
    const output = execFileSync("node", [cliBin, "--help"], {
      encoding: "utf-8",
    });
    expect(output).toContain("ariscan");
  });
});

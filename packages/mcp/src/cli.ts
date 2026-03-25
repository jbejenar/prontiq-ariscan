import { resolve } from "node:path";
import { startServer } from "./server.js";

const args = process.argv.slice(2);

let repoPath = process.cwd();
let cacheTtlMs = 300_000; // 5 minutes
let scanTimeoutMs = 60_000; // 60 seconds

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--path" && args[i + 1]) {
    i++;
    repoPath = resolve(String(args[i]));
  } else if (arg === "--cache-ttl" && args[i + 1]) {
    i++;
    cacheTtlMs = Number(args[i]) * 1000;
  } else if (arg === "--timeout" && args[i + 1]) {
    i++;
    scanTimeoutMs = Number(args[i]) * 1000;
  } else if (arg === "--help" || arg === "-h") {
    process.stderr.write(
      `ariscan-mcp — MCP server exposing read-only ARI readiness data

Usage: ariscan-mcp [options]

Options:
  --path <dir>       Repository path (default: cwd)
  --cache-ttl <sec>  Scan cache TTL in seconds (default: 300)
  --timeout <sec>    Scan timeout in seconds (default: 60)
  -h, --help         Show this help message
`,
    );
    process.exit(0);
  }
}

startServer({ repoPath, cacheTtlMs, scanTimeoutMs }).catch((error: unknown) => {
  process.stderr.write(`Fatal: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});

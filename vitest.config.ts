import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "**/packages/testing/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary"],
      reportsDirectory: "coverage",
      include: ["packages/*/src/**/*.ts"],
      exclude: [
        "**/__tests__/**",
        "**/*.test.ts",
        "**/node_modules/**",
        "**/dist/**",
        "**/packages/testing/**",
      ],
    },
  },
});

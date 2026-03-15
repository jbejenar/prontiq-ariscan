/** Tests for SVG badge generation and badge snippet formatting. */
import { describe, it, expect } from "vitest";
import type { ScanResult } from "@prontiq/ariscan-schema";
import { generateBadgeSvg, generateBadgeSnippets, formatBadge } from "../output/badge.js";

const mockResult: ScanResult = {
  metadata: {
    version: "0.1.0",
    timestamp: "2026-03-08T00:00:00.000Z",
    duration: 500,
    repoPath: "/test/repo",
    rubricVersion: "v1",
  },
  score: 82,
  level: "L5",
  levelMeta: {
    level: "L5",
    name: "Autonomous",
    description: "Complex cross-service tasks, agent self-verifies",
  },
  securityGateTriggered: false,
  pillars: [],
  findings: [],
};

describe("generateBadgeSvg additional coverage", () => {
  it("uses correct colors for each level", () => {
    const levels = [
      { level: "L1", color: "#e05d44" },
      { level: "L2", color: "#fe7d37" },
      { level: "L3", color: "#dfb317" },
      { level: "L4", color: "#97ca00" },
      { level: "L5", color: "#44cc11" },
    ];
    for (const { level, color } of levels) {
      const svg = generateBadgeSvg({ ...mockResult, level: level as ScanResult["level"] });
      expect(svg).toContain(color);
    }
  });

  it("includes title element for accessibility", () => {
    const svg = generateBadgeSvg(mockResult);
    expect(svg).toContain("<title>");
    expect(svg).toContain("Agent-Ready: L5 (82/100)");
  });

  it("uses clipPath for rounded corners", () => {
    const svg = generateBadgeSvg(mockResult);
    expect(svg).toContain("clipPath");
    expect(svg).toContain('rx="3"');
  });

  it("handles unknown level with grey color", () => {
    const unknownResult = { ...mockResult, level: "LX" as ScanResult["level"] };
    const svg = generateBadgeSvg(unknownResult);
    expect(svg).toContain("#9f9f9f");
  });
});

describe("generateBadgeSnippets additional coverage", () => {
  it("uses custom path in snippets", () => {
    const snippets = generateBadgeSnippets("docs/ari-badge.svg");
    expect(snippets).toContain("docs/ari-badge.svg");
    expect(snippets).toContain("![Agent-Ready](docs/ari-badge.svg)");
  });
});

describe("formatBadge", () => {
  it("combines SVG and snippets", () => {
    const output = formatBadge(mockResult, "badge.svg");
    expect(output).toContain("<svg");
    expect(output).toContain("![Agent-Ready](badge.svg)");
  });
});

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

describe("SVG cross-platform rendering (P1.16)", () => {
  it("is valid XML with proper SVG namespace", () => {
    const svg = generateBadgeSvg(mockResult);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toMatch(/^<svg\s/);
    expect(svg).toMatch(/<\/svg>$/);
  });

  it("uses only standard system font families (no @font-face or external fonts)", () => {
    const svg = generateBadgeSvg(mockResult);
    expect(svg).toContain("Verdana");
    expect(svg).toContain("Geneva");
    expect(svg).toContain("DejaVu Sans");
    expect(svg).toContain("sans-serif");
    // Must not use external fonts or @font-face
    expect(svg).not.toContain("@font-face");
    expect(svg).not.toContain("href=");
  });

  it("has explicit width, height, and uses no foreignObject", () => {
    const svg = generateBadgeSvg(mockResult);
    expect(svg).toMatch(/width="\d+"/);
    expect(svg).toMatch(/height="\d+"/);
    expect(svg).not.toContain("foreignObject");
  });

  it("uses only inline styles (no <style> blocks or external CSS)", () => {
    const svg = generateBadgeSvg(mockResult);
    expect(svg).not.toContain("<style");
    expect(svg).not.toContain("class=");
  });

  it("contains accessible role and aria-label", () => {
    const svg = generateBadgeSvg(mockResult);
    expect(svg).toContain('role="img"');
    expect(svg).toContain("aria-label=");
  });

  it("uses no JavaScript or event handlers", () => {
    const svg = generateBadgeSvg(mockResult);
    expect(svg).not.toContain("<script");
    expect(svg).not.toContain("onclick");
    expect(svg).not.toContain("onload");
  });

  it("embeds all text directly (no <use> or <tref> elements)", () => {
    const svg = generateBadgeSvg(mockResult);
    expect(svg).not.toContain("<use ");
    expect(svg).not.toContain("<tref");
    // Text content is directly in <text> elements
    expect(svg).toContain("<text");
    expect(svg).toContain("Agent-Ready");
  });
});

describe("formatBadge", () => {
  it("combines SVG and snippets", () => {
    const output = formatBadge(mockResult, "badge.svg");
    expect(output).toContain("<svg");
    expect(output).toContain("![Agent-Ready](badge.svg)");
  });
});

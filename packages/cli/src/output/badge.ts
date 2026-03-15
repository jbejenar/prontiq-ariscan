import type { ScanResult } from "@prontiq/ariscan-schema";

function levelColor(level: string): string {
  switch (level) {
    case "L1":
      return "#e05d44"; // red
    case "L2":
      return "#fe7d37"; // orange
    case "L3":
      return "#dfb317"; // yellow
    case "L4":
      return "#97ca00"; // green
    case "L5":
      return "#44cc11"; // bright green
    default:
      return "#9f9f9f"; // grey
  }
}

/**
 * Generate an SVG badge showing the ARI score and maturity level.
 * Based on the shields.io badge format for compatibility.
 */
export function generateBadgeSvg(result: ScanResult): string {
  const label = "Agent-Ready";
  const value = `${result.level} (${result.score}/100)`;
  const color = levelColor(result.level);

  const labelWidth = 80;
  const valueWidth = 70;
  const totalWidth = labelWidth + valueWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${value}">
  <title>${label}: ${value}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text aria-hidden="true" x="${labelWidth * 5}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)">${label}</text>
    <text x="${labelWidth * 5}" y="140" transform="scale(.1)">${label}</text>
    <text aria-hidden="true" x="${(labelWidth + valueWidth / 2) * 10}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)">${value}</text>
    <text x="${(labelWidth + valueWidth / 2) * 10}" y="140" transform="scale(.1)">${value}</text>
  </g>
</svg>`;
}

/**
 * Generate embed snippets for the badge in multiple formats.
 */
export function generateBadgeSnippets(badgePath: string): string {
  const lines: string[] = [];
  lines.push("Badge embed snippets:\n");
  lines.push("Markdown:");
  lines.push(`  ![Agent-Ready](${badgePath})\n`);
  lines.push("HTML:");
  lines.push(`  <img src="${badgePath}" alt="Agent-Ready">\n`);
  lines.push("reStructuredText:");
  lines.push(`  .. image:: ${badgePath}\n     :alt: Agent-Ready\n`);
  return lines.join("\n") + "\n";
}

/**
 * Format badge output: SVG content + embed snippets for CLI display.
 */
export function formatBadge(result: ScanResult, outputPath: string): string {
  return generateBadgeSvg(result) + "\n\n" + generateBadgeSnippets(outputPath);
}

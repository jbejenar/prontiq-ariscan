import { describe, it, expect } from "vitest";
import {
  extractImports,
  detectExtractorLanguage,
  resolveRelativeImport,
} from "../../graph/import-extractor.js";

describe("detectExtractorLanguage", () => {
  it("detects TypeScript files", () => {
    expect(detectExtractorLanguage("src/app.ts")).toBe("typescript");
    expect(detectExtractorLanguage("src/component.tsx")).toBe("typescript");
    expect(detectExtractorLanguage("lib/util.mts")).toBe("typescript");
  });

  it("detects JavaScript files", () => {
    expect(detectExtractorLanguage("src/app.js")).toBe("typescript"); // JS uses same extractor
    expect(detectExtractorLanguage("src/app.mjs")).toBe("typescript");
  });

  it("detects Python files", () => {
    expect(detectExtractorLanguage("src/app.py")).toBe("python");
    expect(detectExtractorLanguage("types/models.pyi")).toBe("python");
  });

  it("detects Go files", () => {
    expect(detectExtractorLanguage("main.go")).toBe("go");
  });

  it("detects Java files", () => {
    expect(detectExtractorLanguage("src/Main.java")).toBe("java");
  });

  it("returns unknown for unsupported extensions", () => {
    expect(detectExtractorLanguage("style.css")).toBe("unknown");
    expect(detectExtractorLanguage("README.md")).toBe("unknown");
  });
});

describe("resolveRelativeImport", () => {
  it("resolves sibling imports", () => {
    expect(resolveRelativeImport("src/a.ts", "./b")).toBe("src/b");
  });

  it("resolves parent imports", () => {
    expect(resolveRelativeImport("src/sub/a.ts", "../b")).toBe("src/b");
  });

  it("resolves nested relative imports", () => {
    expect(resolveRelativeImport("src/a.ts", "./sub/b")).toBe("src/sub/b");
  });

  it("strips file extensions from import path", () => {
    expect(resolveRelativeImport("src/a.ts", "./b.js")).toBe("src/b");
  });
});

describe("extractImports — TypeScript/JavaScript", () => {
  it("extracts ES module imports", () => {
    const content = `
import { foo } from './foo';
import bar from '../bar';
import * as utils from './utils/index';
`.trim();
    const imports = extractImports(content, "src/main.ts");
    const relative = imports.filter((i) => i.kind === "relative");
    expect(relative).toHaveLength(3);
    expect(relative.map((i) => i.target)).toContain("src/foo");
    expect(relative.map((i) => i.target)).toContain("bar");
    expect(relative.map((i) => i.target)).toContain("src/utils/index");
  });

  it("extracts require calls", () => {
    const content = `const x = require('./helper');`;
    const imports = extractImports(content, "src/main.js");
    expect(imports).toHaveLength(1);
    expect(imports[0]?.target).toBe("src/helper");
    expect(imports[0]?.kind).toBe("relative");
  });

  it("extracts re-exports", () => {
    const content = `export { foo } from './foo';`;
    const imports = extractImports(content, "src/index.ts");
    expect(imports).toHaveLength(1);
    expect(imports[0]?.kind).toBe("relative");
  });

  it("extracts package imports", () => {
    const content = `import express from 'express';`;
    const imports = extractImports(content, "src/app.ts");
    expect(imports).toHaveLength(1);
    expect(imports[0]?.kind).toBe("package");
    expect(imports[0]?.target).toBe("express");
  });

  it("skips comment lines", () => {
    const content = `
// import { foo } from './foo';
/* import { bar } from './bar'; */
import { baz } from './baz';
`.trim();
    const imports = extractImports(content, "src/main.ts");
    const relative = imports.filter((i) => i.kind === "relative");
    expect(relative).toHaveLength(1);
    expect(relative[0]?.target).toBe("src/baz");
  });
});

describe("extractImports — Python", () => {
  it("extracts absolute imports", () => {
    const content = `
import os
import json
from pathlib import Path
`.trim();
    const imports = extractImports(content, "src/main.py");
    expect(imports).toHaveLength(3);
    expect(imports.every((i) => i.kind === "package")).toBe(true);
  });

  it("extracts relative imports", () => {
    const content = `from .utils import helper`;
    const imports = extractImports(content, "src/main.py");
    expect(imports).toHaveLength(1);
    expect(imports[0]?.kind).toBe("relative");
    expect(imports[0]?.target).toBe("src/utils");
  });

  it("extracts parent relative imports", () => {
    const content = `from ..common import shared`;
    const imports = extractImports(content, "src/sub/main.py");
    expect(imports).toHaveLength(1);
    // from ..common in src/sub/ goes up 1 level to src/, then appends common
    expect(imports[0]?.target).toBe("src/common");
  });

  it("skips comments", () => {
    const content = `
# import os
from pathlib import Path
`.trim();
    const imports = extractImports(content, "main.py");
    expect(imports).toHaveLength(1);
  });
});

describe("extractImports — Go", () => {
  it("extracts single imports", () => {
    const content = `import "fmt"`;
    const imports = extractImports(content, "main.go");
    expect(imports).toHaveLength(1);
    expect(imports[0]?.target).toBe("fmt");
  });

  it("extracts grouped imports", () => {
    const content = `
import (
  "fmt"
  "os"
  "github.com/pkg/errors"
)
`.trim();
    const imports = extractImports(content, "main.go");
    expect(imports).toHaveLength(3);
  });
});

describe("extractImports — Java", () => {
  it("extracts Java imports", () => {
    const content = `
import java.util.List;
import com.example.service.UserService;
import static org.junit.Assert.assertEquals;
`.trim();
    const imports = extractImports(content, "src/Main.java");
    expect(imports).toHaveLength(3);
    expect(imports[0]?.target).toBe("java/util/List");
  });
});

describe("extractImports — unknown language", () => {
  it("returns empty for unsupported files", () => {
    const imports = extractImports("body { color: red; }", "style.css");
    expect(imports).toHaveLength(0);
  });
});

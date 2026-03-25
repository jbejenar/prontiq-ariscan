/**
 * Tree-sitter queries for extracting import statements per language.
 *
 * Each query targets import/require nodes in the AST and extracts
 * the module path. These are used when tree-sitter WASM grammars
 * are available for higher accuracy than regex patterns.
 */

import type { TreeSitterLanguage } from "./loader.js";

/**
 * S-expression query strings for tree-sitter per language.
 * These target import statement nodes and capture the module path string.
 */
export const IMPORT_QUERIES: Partial<Record<TreeSitterLanguage, string>> = {
  typescript: `
    ;; ES module imports: import X from "path"
    (import_statement source: (string (string_fragment) @path))
    ;; Dynamic require: require("path")
    (call_expression
      function: (identifier) @_func (#eq? @_func "require")
      arguments: (arguments (string (string_fragment) @path)))
    ;; Re-exports: export { X } from "path"
    (export_statement source: (string (string_fragment) @path))
  `,

  javascript: `
    (import_statement source: (string (string_fragment) @path))
    (call_expression
      function: (identifier) @_func (#eq? @_func "require")
      arguments: (arguments (string (string_fragment) @path)))
    (export_statement source: (string (string_fragment) @path))
  `,

  python: `
    ;; import module
    (import_statement name: (dotted_name) @path)
    ;; from module import name
    (import_from_statement module_name: (dotted_name) @path)
    (import_from_statement module_name: (relative_import) @path)
  `,

  go: `
    ;; import "path"
    (import_spec path: (interpreted_string_literal) @path)
  `,

  java: `
    ;; import com.example.Class
    (import_declaration (scoped_identifier) @path)
  `,
};

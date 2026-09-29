import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

const RELATIVE_IMPORTS = { group: ["./*", "../*"], message: "Import via the @/ or @tests/ alias only (CLAUDE.md)." };
const LIB_FORBIDDEN_MODULES = ["node:fs", "node:fs/promises", "node:process", "node:child_process"].map((name) => ({
  name,
  message: "src/lib is pure: file system and process access belong to src/io (CLAUDE.md).",
}));

// Import direction is enforced here: cli, hooks → io → lib → config → types.
const restrictImports = (forbiddenLayers, paths = []) => [
  "error",
  {
    paths,
    patterns: [
      RELATIVE_IMPORTS,
      ...forbiddenLayers.map((layer) => ({
        group: [`@/${layer}/*`],
        message: `This layer must not import @/${layer} (import direction, CLAUDE.md).`,
      })),
    ],
  },
];

export default defineConfig([
  globalIgnores(["node_modules", "runs"]),
  { files: ["**/*.js"], extends: [js.configs.recommended], languageOptions: { globals: globals.node } },
  {
    files: ["**/*.ts"],
    extends: [js.configs.recommended, tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "never" }],
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "func-style": ["error", "expression"],
      "no-restricted-syntax": [
        "error",
        { selector: "ClassDeclaration, ClassExpression", message: "No classes: use arrow functions (CLAUDE.md)." },
        { selector: "TSEnumDeclaration", message: "Use a union type instead of enum (CLAUDE.md)." },
        { selector: "TSModuleDeclaration", message: "No namespaces (CLAUDE.md)." },
        { selector: "ExportDefaultDeclaration", message: "Named exports only (CLAUDE.md)." },
      ],
      "no-restricted-imports": restrictImports([]),
    },
  },
  {
    files: ["src/types/**/*.ts"],
    rules: { "no-restricted-imports": restrictImports(["config", "lib", "io", "cli", "hooks"]) },
  },
  { files: ["src/config/**/*.ts"], rules: { "no-restricted-imports": restrictImports(["lib", "io", "cli", "hooks"]) } },
  {
    files: ["src/lib/**/*.ts"],
    rules: {
      "no-restricted-imports": restrictImports(["io", "cli", "hooks"], LIB_FORBIDDEN_MODULES),
      "no-restricted-globals": ["error", "process"],
    },
  },
  { files: ["src/io/**/*.ts"], rules: { "no-restricted-imports": restrictImports(["cli", "hooks"]) } },
  { files: ["src/cli/**/*.ts"], rules: { "no-restricted-imports": restrictImports(["hooks"]) } },
  { files: ["src/hooks/**/*.ts"], rules: { "no-restricted-imports": restrictImports(["cli"]) } },
  {
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-floating-promises": [
        "error",
        { allowForKnownSafeCalls: [{ from: "package", package: "node:test", name: ["describe", "test"] }] },
      ],
    },
  },
  eslintConfigPrettier,
]);

import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

// No a11y lint: accessibility lint is intentionally off — see CLAUDE.md
// ("No accessibility (a11y) lint" under Coding Standards).
const eslintConfig = defineConfig([
  globalIgnores(["dist/**"]),
  js.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs.flat["recommended-latest"],
  {
    languageOptions: { globals: { ...globals.browser } },
  },
]);

export default eslintConfig;

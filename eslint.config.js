import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

// Focused lint gate: hooks-order violations crash pages at runtime and are
// invisible to tsc/tests, so they are errors here. Only hooks rules run —
// keep this gate fast and free of style noise.
export default tseslint.config(
  {
    ignores: ["dist/**", "drizzle/**", "node_modules/**", "docs/**"],
  },
  {
    files: ["client/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
);

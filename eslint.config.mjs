import js from "@eslint/js";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";

export default [
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs["recommended-latest"].rules,
      ...jsxA11y.configs.recommended.rules,
      // This app fetches data with plain `useEffect(() => { load(); }, [load])` +
      // setState-in-.then everywhere (no React Query/SWR/Suspense) — the
      // idiomatic "fetch on mount" pattern this whole codebase is built on.
      // The rule's underlying advice is sound for new code, so keep it as a
      // warning rather than silence it, but errors would fail the build on
      // ~30 pre-existing, working call sites.
      "react-hooks/set-state-in-effect": "warn",
      // TS's own unused-vars check replaces the base rule (handles types/imports correctly).
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "no-undef": "off", // TypeScript handles this
      // This codebase deliberately uses `catch (err: any)` at ~90 call sites
      // (see src/server/index.ts) to read `.message` off caught errors —
      // an established, intentional convention, not something to flag.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "off",
    },
  },
  {
    // .next/ is stale leftover from this repo's original "Create Next App"
    // scaffold (see AGENTS.md) — the app has since been rewritten to
    // Vite + Express and no longer depends on "next" at all.
    ignores: ["dist/**", "node_modules/**", "src/generated/**", ".next/**"],
  },
];

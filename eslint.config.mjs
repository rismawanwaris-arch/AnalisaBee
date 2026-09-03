import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "off", // TypeScript handles this
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "src/generated/**"],
  },
];

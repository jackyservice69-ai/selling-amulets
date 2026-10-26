import js from "@eslint/js";
import ts from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
import globals from "globals";
export default ts.config(
  {
    ignores: [
      "dist/**",
      "dist-server/**",
      "node_modules/**",
      ".generated/**",
      ".tools/**",
      "test-results/**",
      "playwright-report/**",
      "output/**",
      ".playwright-cli/**",
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { "react-hooks": hooks },
    rules: {
      ...hooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  { files: ["**/*.{js,mjs}"], languageOptions: { globals: globals.node } },
);

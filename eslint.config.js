import js from "@eslint/js";
import globals from "globals";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

const reactRecommended = react.configs.flat.recommended;
const reactJsxRuntime = react.configs.flat["jsx-runtime"];
const reactHooksRecommended = reactHooks.configs.flat["recommended-latest"];

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "apps/api/prisma/migrations/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },
  {
    files: ["apps/web/**/*.{js,jsx}"],
    languageOptions: {
      ...reactRecommended.languageOptions,
      globals: globals.browser,
    },
    plugins: {
      ...reactRecommended.plugins,
      ...reactHooksRecommended.plugins,
      ...reactRefresh.configs.vite.plugins,
      ...jsxA11y.flatConfigs.recommended.plugins,
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...reactRecommended.rules,
      ...reactJsxRuntime.rules,
      ...reactHooksRecommended.rules,
      ...reactRefresh.configs.vite.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "react/prop-types": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: [
      "apps/api/**/*.js",
      "apps/web/vite.config.js",
      "eslint.config.js",
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["apps/web/src/**/*.{test,spec}.{js,jsx}"],
    languageOptions: {
      globals: globals.vitest,
    },
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: ["apps/api/tests/**/*.js"],
    languageOptions: {
      globals: globals.jest,
    },
  },
];

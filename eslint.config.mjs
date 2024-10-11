import globals from "globals";
import * as espree from "espree";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: ["**/node_modules", ".history"],
  },
  ...compat.extends("plugin:prettier/recommended"),
  {
    languageOptions: {
      globals: {
        ...globals.mocha,
      },

      parser: espree,
      ecmaVersion: 2020,
      sourceType: "module",

      parserOptions: {
        requireConfigFile: false,
        modules: true,
      },
    },

    rules: {
      "no-await-in-loop": "off",
      "new-cap": "off",
      "quote-props": "off",
      "no-negated-condition": "off",
      "no-warning-comments": "off",
      "spaced-comment": "off",
      "max-nested-callbacks": "off",
      "no-else-return": "off",
      "no-console": "off",
      "no-multi-str": "off",
      "no-prototype-builtins": "off",

      "node/no-unsupported-features": "off",
      camelcase: "off",
    },
  },
  {
    files: ["test/**/*.mjs"],

    rules: {
      "no-unused-expressions": "off",
    },
  },
];

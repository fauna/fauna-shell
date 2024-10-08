import globals from "globals";
import babelParser from "@babel/eslint-parser";
// import tsParser from "@typescript-eslint/parser";
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
    ignores: [
      "dist/**/*",
      "**/experiments",
      "**/node_modules",
      "coverage/**/*",
      "fsl/**/*",
      "test/**/*",
      ".history",
    ],
  },
  ...compat.extends("oclif", "plugin:prettier/recommended"),
  {
    languageOptions: {
      globals: {
        ...globals.mocha,
      },

      parser: babelParser,
      ecmaVersion: 6,
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

      "node/no-extraneous-require": [
        "error",
        {
          allowModules: [],
        },
      ],

      "node/no-unsupported-features": "off",
      camelcase: "off",
    },
  },
  {
    files: ["yargs-test/**/*.mjs"],

    rules: {
      "no-unused-expressions": "off",
    },
  },
];

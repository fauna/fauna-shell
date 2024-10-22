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

import defaultConfig from "@fauna/typescript/config/eslint.config.js";
export default [
  ...defaultConfig,
  ...compat.extends("plugin:prettier/recommended"),
  {
    languageOptions: {
      globals: {
        ...globals.mocha,
      },

      parser: espree,
      sourceType: "module",

      parserOptions: {
        requireConfigFile: false,
        modules: true,
      },
    },
  },
];

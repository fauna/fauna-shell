import { config as defaultConfig } from "@fauna/typescript/config/js/eslint.config.js";
import * as espree from "espree";
import globals from "globals";

export default [
  ...defaultConfig,
  {
    languageOptions: {
      ecmaVersion: 2024,
      globals: {
        ...globals.mocha,
        ...globals.nodeBuiltin,

        // cjs globals
        require: "readonly",
        exports: "readonly",
        __filename: "readonly",
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

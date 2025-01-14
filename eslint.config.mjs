import { config as defaultConfig } from "@fauna/ts-dev-utils/config/js/eslint.config.js";
import * as espree from "espree";
import globals from "globals";

export default [
  ...defaultConfig,
  {
    languageOptions: {
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

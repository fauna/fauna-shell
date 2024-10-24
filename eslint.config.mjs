import { config as defaultConfig } from "@fauna/typescript/config/js/eslint.config.js";
import * as espree from "espree";
import globals from "globals";

export default [
  ...defaultConfig,
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

import globals from "globals";
import * as espree from "espree";
import { config as defaultConfig } from "@fauna/typescript/config/eslint.config.js";

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

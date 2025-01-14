import chalk from "chalk";
import { createHighlighterCoreSync } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import json from "shiki/langs/json.mjs";
import log from "shiki/langs/log.mjs";
import tsv from "shiki/langs/tsv.mjs";
import yaml from "shiki/langs/yaml.mjs";
import githubDarkHighContrast from "shiki/themes/github-dark-high-contrast.mjs";

import { isTTY } from "../utils.mjs";
import { fql } from "./fql.mjs";

const THEME = "github-dark-high-contrast";

export const createHighlighter = () => {
  const highlighter = createHighlighterCoreSync({
    themes: [githubDarkHighContrast],
    langs: [fql, log, json, yaml, tsv],
    engine: createJavaScriptRegexEngine(),
  });

  return highlighter;
};

function rgbToHex(r, g, b) {
  return [r, g, b]
    .map((x) => {
      const hex = x.toString(16);
      return hex.length === 1 ? `0${hex}` : hex;
    })
    .join("");
}

function normalizeHex(hex) {
  hex = hex.replace(/#/, "");
  if (hex.length === 3)
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  if (hex.length === 4)
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  if (hex.length === 6) hex = `${hex}ff`;
  return hex.toLowerCase();
}

function hexToRgba(hex) {
  hex = normalizeHex(hex);
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  const a = Number.parseInt(hex.slice(6, 8), 16) / 255;
  return { r, g, b, a };
}

export function hexApplyAlpha(hex, type = "dark") {
  const { r, g, b, a } = hexToRgba(hex);
  if (type === "dark") return rgbToHex(r * a, g * a, b * a);
  else
    return rgbToHex(
      r * a + 255 * (1 - a),
      g * a + 255 * (1 - a),
      b * a + 255 * (1 - a),
    );
}

const { codeToTokensBase, getTheme } = createHighlighter();

/**
 * Returns a string with ANSI codes applied to the code. This is a JS port of the
 * TypeScript codeToAnsi function from the Shiki library.
 * @param {*} code - The code to format.
 * @param {"fql" | "log" | "json"} language - The language of the code.
 * @returns {string} - The formatted code with ANSI codes applied.
 */
export function codeToAnsi(code, language) {
  if (!isTTY()) return code;

  let output = "";

  const lines = codeToTokensBase(code, {
    lang: language,
    theme: THEME,
  });
  const theme = getTheme(THEME);

  for (const line of lines) {
    for (const token of line) {
      let text = token.content;
      const color = token.color || theme.fg;

      if (color) {
        text = chalk.hex(hexApplyAlpha(color, theme.type))(text);
      }

      if (token.fontStyle) {
        if (token.fontStyle & 2) text = chalk.bold(text);
        if (token.fontStyle & 1) text = chalk.italic(text);
        if (token.fontStyle & 4) text = chalk.underline(text);
      }

      output += text;
    }
    output += "\n";
  }

  return output;
}

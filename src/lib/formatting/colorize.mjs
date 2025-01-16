import stripAnsi from "strip-ansi";
import YAML from "yaml";

import { container } from "../../config/container.mjs";
import { codeToAnsi } from "./codeToAnsi.mjs";

export const Language = {
  FQL: "fql",
  LOG: "log",
  JSON: "json",
  TEXT: "text",
  YAML: "yaml",
  TSV: "tsv",
};

const objToString = (obj) => JSON.stringify(obj, null, 2);

const textToAnsi = (obj) => {
  if (typeof obj !== "string") {
    throw new Error('Unable to format "text" unless it is already a string.');
  }

  return obj;
};

const fqlToAnsi = (obj) => {
  if (typeof obj !== "string") {
    throw new Error("Unable to format FQL unless it is already a string.");
  }

  const raw = stripAnsi(obj);
  const codeToAnsi = container.resolve("codeToAnsi");
  const res = codeToAnsi(raw, "fql");

  return res.trim();
};

const jsonToAnsi = (obj) => {
  const codeToAnsi = container.resolve("codeToAnsi");
  const stringified = objToString(obj);
  const res = codeToAnsi(stringified, "json");

  if (!res) {
    return "";
  }

  return res.trim();
};

const logToAnsi = (obj) => {
  if (typeof obj !== "string") {
    throw new Error("Unable to format LOG unless it is already a string.");
  }
  const res = codeToAnsi(obj, "log");
  return res.trim();
};

const yamlToAnsi = (obj) => {
  const codeToAnsi = container.resolve("codeToAnsi");
  const stringified = YAML.stringify(obj, { lineWidth: 0 });
  const res = codeToAnsi(stringified, "yaml");

  if (!res) {
    return "";
  }

  return res.trim();
};

const tsvToAnsi = (obj) => {
  if (typeof obj !== "string") {
    throw new Error("Unable to format TSV unless it is already a string.");
  }

  const raw = stripAnsi(obj);
  const codeToAnsi = container.resolve("codeToAnsi");
  const res = codeToAnsi(raw, "tsv");

  return res.trim();
};

/**
 * Formats an object for display with ANSI color codes.
 * @param {any} obj - The object to format
 * @param {object} opts - Options
 * @param {string} [opts.format] - The format to use
 * @returns {string} The formatted object
 */
export const toAnsi = (obj, { format = Language.TEXT } = {}) => {
  switch (format) {
    case Language.FQL:
      return fqlToAnsi(obj);
    case Language.JSON:
      return jsonToAnsi(obj);
    case Language.LOG:
      return logToAnsi(obj);
    case Language.YAML:
      return yamlToAnsi(obj);
    case Language.TSV:
      return tsvToAnsi(obj);
    default:
      return textToAnsi(obj);
  }
};

/**
 * Formats an input for display based on its format and options.
 * @param {any} obj - The object to format
 * @param {object} opts - Options
 * @param {string} [opts.language] - The language to use with the highlighter
 * @param {boolean} [opts.color] - Whether to colorize the object
 * @returns {string} The formatted object
 */
export const colorize = (
  obj,
  { color = true, language = Language.TEXT } = {},
) => {
  const ansiString = toAnsi(obj, { format: language });

  if (color) {
    return ansiString;
  }

  return ansiString ? stripAnsi(ansiString) : "";
};

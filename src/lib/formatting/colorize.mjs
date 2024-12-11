import stripAnsi from "strip-ansi";

import { container } from "../../cli.mjs";

export const Format = {
  FQL: "fql",
  JSON: "json",
  TEXT: "text",
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

/**
 * Formats an object for display with ANSI color codes.
 * @param {any} obj - The object to format
 * @param {object} opts - Options
 * @param {string} [opts.format] - The format to use
 * @returns {string} The formatted object
 */
export const toAnsi = (obj, { format = Format.TEXT } = {}) => {
  switch (format) {
    case Format.FQL:
      return fqlToAnsi(obj);
    case Format.JSON:
      return jsonToAnsi(obj);
    default:
      return textToAnsi(obj);
  }
};

/**
 * Formats an input for display based on its format and options.
 * @param {any} obj - The object to format
 * @param {object} opts - Options
 * @param {string} [opts.format] - The format to use
 * @param {boolean} [opts.color] - Whether to colorize the object
 * @returns {string} The formatted object
 */
export const colorize = (obj, { color = true, format = Format.TEXT } = {}) => {
  const ansiString = toAnsi(obj, { format });

  if (color) {
    return ansiString;
  }

  return ansiString ? stripAnsi(ansiString) : "";
};

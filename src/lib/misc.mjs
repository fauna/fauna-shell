import util from "node:util";
import { createContext, runInContext } from "node:vm";

import { container } from "../cli.mjs";

export async function runQuery(expression, client) {
  const faunadb = (await import("faunadb")).default;
  const wireReadyQuery = runInContext(expression, createContext(faunadb.query));
  try {
    return client.query(wireReadyQuery);
  } catch (err) {
    err.message = util.inspect(JSON.parse(err.requestResult.responseRaw), {
      depth: null,
      compact: false,
    });

    throw err;
  }
}

export class InvalidCredsError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidCredsError";
    this.status = 401;
  }
}

export class UnauthorizedError extends Error {
  constructor(message) {
    super(message);
    this.name = "UnauthorizedError";
    this.status = 403;
  }
}

export function isTTY() {
  return process.stdout.isTTY;
}

/**
 * Formats an object for display.
 * @param {any} obj - The object to format
 * @param {object} [opts] - Options
 * @param {boolean} [opts.json] - Whether to return a JSON string with no pretty-printing
 * @returns {string} The formatted object
 */
export function formatObject(obj, opts = {}) {
  const { json } = opts;
  // if json is set return a JSON string
  if (json) {
    return JSON.stringify(obj);
  }
  // Otherwise, return a pretty-printed JSON string
  return formatObjectForShell(obj, opts);
}

/**
 * Formats an object for display in the shell.
 * @param {any} obj - The object to format
 * @param {object} [opts] - Options
 * @param {boolean} [opts.color] - Whether to colorize the object
 * @returns {string} The formatted object
 */
export function formatObjectForShell(obj, { color = true } = {}) {
  if (!color || !isTTY()) {
    return JSON.stringify(obj, null, 2);
  }

  return container.resolve("colorize")(JSON.stringify(obj, null, 2));
}

/**
 * Formats an error for display in the shell. Use this when you want to see
 * the full error object. Use specific formatting logic in your commands
 * if you are creating a summary message. This is best used with --extra.
 * @param {any} err - The error to format
 * @param {object} [opts] - Options
 * @param {boolean} [opts.color] - Whether to colorize the error
 * @returns {string} The formatted error
 */
export function formatFullErrorForShell(err, { color = true } = {}) {
  if (!color || !isTTY()) {
    return JSON.stringify(err, null, 2);
  }

  return container.resolve("colorize")(JSON.stringify(err, null, 2));
}

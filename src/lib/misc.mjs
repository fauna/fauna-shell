import util from "node:util";
import { createContext, runInContext } from "node:vm";

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

/**
 * Formats an object for display in the shell.
 * @param {any} obj - The object to format
 * @returns {string} The formatted object
 */
export function formatObjectForShell(obj) {
  return JSON.stringify(obj, null, 2);
}

/**
 * Formats an error for display in the shell. Use this when you want to see
 * the full error object. Use specific formatting logic in your commands
 * if you are creating a summary message. This is best used with --extra.
 * @param {any} err - The error to format
 * @returns {string} The formatted error
 */
export function formatFullErrorForShell(err) {
  return util.inspect(err, { depth: null, compact: false });
}

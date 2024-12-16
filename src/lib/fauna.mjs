//@ts-check
/**
 * @fileoverview Fauna V10 client utilities for query execution and error handling.
 */

import chalk from "chalk";
import { NetworkError, ServiceError } from "fauna";

import { container } from "../cli.mjs";
import {
  AuthenticationError,
  AuthorizationError,
  CommandError,
  NETWORK_ERROR_MESSAGE,
  ValidationError,
} from "./errors.mjs";
import { formatQuerySummary } from "./fauna-client.mjs";
import { colorize, Format } from "./formatting/colorize.mjs";

/**
 * Interprets a string as a FQL expression and returns a query.
 * @param {string} expression - The FQL expression to interpret
 * @returns {Promise<import("fauna").Query<any>>} The resulting query
 */
export async function stringExpressionToQuery(expression) {
  const { fql } = container.resolve("fauna");
  return fql([expression]);
}

/**
 * Default options for V10 Fauna queries.
 *
 * @type {import("fauna").QueryOptions}
 */
export const defaultV10QueryOptions = {
  format: "simple",
  typecheck: false,
};

/**
 * Creates a V10 Client instance.
 *
 * @param {object} opts
 * @param {string} opts.url
 * @param {string} opts.secret
 * @returns {import("fauna").Client}
 */
export const getClient = ({ url, secret }) => {
  const Client = container.resolve("fauna").Client;

  // Check for required arguments.
  if (!secret) {
    throw new ValidationError(
      "No secret provided. Pass --secret or --database.",
    );
  }
  // Create the client.
  return new Client({ secret, endpoint: url ? new URL(url) : undefined });
};

/**
 * Runs a V10 Fauna query. A client may be provided, or a url
 * and secret may be used to create one.
 *
 * @param {object} opts
 * @param {import("fauna").Query<any>} opts.query
 * @param {string} [opts.url]
 * @param {string} [opts.secret]
 * @param {import("fauna").Client} [opts.client]
 * @param {import("fauna").QueryOptions} [opts.options]
 * @returns {Promise<import("fauna").QuerySuccess<any>>}
 */
export const runQuery = async ({
  query,
  url,
  secret,
  client,
  options = {},
}) => {
  // Check for required arguments.
  if (!query) {
    throw new ValidationError("A query is required.");
  }

  // Create the client if one wasn't provided.
  let _client =
    client ??
    getClient({
      url: /** @type {string} */ (url), // We know this is a string because we check for !url above.
      secret: /** @type {string} */ (secret), // We know this is a string because we check for !secret above.
    });
  // Run the query.
  return _client
    .query(query, { ...defaultV10QueryOptions, ...options })
    .finally(() => {
      // Clean up the client if one was created internally.
      if (!client && _client) _client.close();
    });
};

/**
 * Runs a V10 Fauna query from a string expression.
 *
 * @param {object} opts
 * @param {string} opts.expression - The FQL expression to interpret
 * @param {string} [opts.url]
 * @param {string} [opts.secret]
 * @param {import("fauna").Client} [opts.client]
 * @param {import("fauna").QueryOptions} [opts.options]
 * @returns {Promise<import("fauna").QuerySuccess<any>>}
 */
export const runQueryFromString = async ({
  expression,
  url,
  secret,
  client,
  options = {},
}) => {
  const query = await stringExpressionToQuery(expression);
  return runQuery({ query, url, secret, client, options });
};

/**
 * Formats a V10 Fauna error for display.
 *
 * @param {any} err - An error to format
 * @param {object} [opts]
 * @param {boolean} [opts.color] - Whether to colorize the error
 * @returns {string} The formatted error message
 */
// eslint-disable-next-line no-unused-vars
export const formatError = (err, _opts = {}) => {
  // If the error has a queryInfo object with a summary property, we can format it.
  // Doing this check allows this code to avoid a fauna direct dependency.
  if (
    err &&
    typeof err.queryInfo === "object" &&
    typeof err.queryInfo.summary === "string"
  ) {
    // Otherwise, return the summary and fall back to the message.
    return `${chalk.red("The query failed with the following error:")}\n\n${formatQuerySummary(err.queryInfo?.summary) ?? err.message}`;
  } else {
    if (err.name === "NetworkError") {
      return `The query failed unexpectedly with the following error:\n\n${NETWORK_ERROR_MESSAGE}`;
    }

    return `The query failed unexpectedly with the following error:\n\n${err.message}`;
  }
};

/**
 * Formats a V10 Fauna query response.
 * @par [ am {import("fauna").QuerySuccess<any>} res
 * @param {object} [opts]
 * @param {string} [opts.format] - The format to use
 * @param {boolean} [opts.color] - Whether to colorize the response
 * @returns {string} The formatted response
 */
export const formatQueryResponse = (res, opts = {}) => {
  const { format = Format.JSON, color } = opts;

  const data = res.data;
  return colorize(data, { format, color });
};

/**
 * Error handler for errors thrown by the V10 driver. Custom handlers
 * can be provided for different types of errors, and a default error
 * message is thrown if no handler is provided. This may be used when we run
 * commands on the users behalf and want to provide a more helpful error message.
 *
 * @param {import("fauna").FaunaError} e - The Fauna error to handle
 * @param {(e: import("fauna").FaunaError) => void} [handler] - Optional error handler to handle and throw in
 * @throws {Error} Always throws an error with a message based on the error code or handler response
 * @returns {never} This function always throws an error
 */

export const faunaToCommandError = (e, handler) => {
  if (handler) {
    handler(e);
  }

  if (e instanceof ServiceError) {
    switch (e.code) {
      case "unauthorized":
        throw new AuthenticationError({ cause: e });
      case "forbidden":
        throw new AuthorizationError({ cause: e });
      case "permission_denied":
        throw new AuthorizationError({ cause: e });
      default:
        throw new CommandError(formatError(e), { cause: e });
    }
  }

  if (e instanceof NetworkError) {
    throw new CommandError(NETWORK_ERROR_MESSAGE, { cause: e });
  }

  throw e;
};

//@ts-check
/**
 * @fileoverview Fauna V10 client utilities for query execution and error handling.
 */
import chalk from "chalk";
import { NetworkError, ServiceError } from "fauna";
import stripAnsi from "strip-ansi";

import { container } from "../config/container.mjs";
import {
  AuthenticationError,
  AuthorizationError,
  CommandError,
  NETWORK_ERROR_MESSAGE,
  ValidationError,
} from "./errors.mjs";
import { colorize, Format } from "./formatting/colorize.mjs";

/**
 * Regex to match the FQL diagnostic line.
 * @type {RegExp}
 */
export const FQL_DIAGNOSTIC_REGEX = /^(\s{2,}\|)|(\s*\d{1,}\s\|)/;

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
 * Formats a summary of a query from a fauna
 * @param {string} summary - The summary of the query
 * @returns {string}
 */
export const formatQuerySummary = (summary) => {
  if (!summary || typeof summary !== "string") {
    return "";
  }

  try {
    const lines = summary.split("\n").map((line) => {
      if (!line.match(FQL_DIAGNOSTIC_REGEX)) {
        return line;
      }
      return colorize(line, { format: Format.FQL });
    });
    return lines.join("\n");
  } catch (err) {
    const logger = container.resolve("logger");
    logger.debug(`Unable to parse performance hint: ${err}`);
    return summary;
  }
};

const getQueryInfoValue = (response, field) => {
  switch (field) {
    case "txnTs":
      return response.txn_ts;
    case "schemaVersion":
      return response.schema_version?.toString();
    case "summary":
      return response.summary;
    case "queryTags":
      return response.query_tags;
    case "stats":
      return response.stats;
    default:
      return undefined;
  }
};

const getIncludedQueryInfo = (response, include) => {
  const queryInfo = {};
  include.forEach((field) => {
    const value = getQueryInfoValue(response, field);
    if (value) queryInfo[field] = value;
  });
  return queryInfo;
};

/**
 *
 * @param {object} response - The v10 query response with query info
 * @param {object} opts
 * @param {boolean} opts.color - Whether to colorize the error
 * @param {string[]} opts.include - The query info fields to include
 * @returns
 */
export const formatQueryInfo = (response, { color, include }) => {
  const queryInfoToDisplay = getIncludedQueryInfo(response, include);

  if (Object.keys(queryInfoToDisplay).length === 0) return "";

  // We colorize the entire query info object as YAML, but then need to
  // colorize the diagnostic lines individually. To simplify this, we
  // strip the ansi when we're checking if the line is a diagnostic line.
  const colorized = colorize(queryInfoToDisplay, {
    color,
    format: Format.YAML,
  })
    .split("\n")
    .map((line) => {
      if (!stripAnsi(line).match(FQL_DIAGNOSTIC_REGEX)) {
        return line;
      }
      return colorize(line, { format: Format.FQL });
    })
    .join("\n");

  return `${colorized}\n`;
};

/**
 * Formats a V10 Fauna error for display.
 *
 * @param {any} err - An error to format
 * @param {object} opts
 * @param {boolean} opts.color - Whether to colorize the error
 * @param {string[]} opts.include - The query info fields to include
 * @returns {string} The formatted error message
 */

export const formatError = (err, { color, include }) => {
  let message = "";
  // If the error has a queryInfo object with a summary property, we can format it.
  // Doing this check allows this code to avoid a fauna direct dependency.
  if (
    err &&
    typeof err.queryInfo === "object" &&
    typeof err.queryInfo.summary === "string"
  ) {
    // Remove the summary from the include list. We will always show the summary
    // under the error, so we don't want to include it in the query info.
    const _include = include.filter((i) => i !== "summary");
    const queryInfo = formatQueryInfo(err.queryInfo, {
      color,
      include: _include,
    });
    message = queryInfo === "" ? "" : `${queryInfo}\n`;

    const summary = formatQuerySummary(err.queryInfo?.summary ?? "");
    message += `${chalk.red("The query failed with the following error:")}\n\n${summary}`;

    // err.abort could be `null`, if that's what the user returns
    if (err.abort !== undefined) {
      const abort = colorize(err.abort, { format: "fql", color });
      message += `\n\n${chalk.red("Abort value:")}\n${abort}`;
    }
    if (err.constraint_failures !== undefined) {
      const contraintFailures = colorize(
        JSON.stringify(err.constraint_failures, null, 2),
        {
          format: "fql",
          color,
        },
      );
      message += `\n\n${chalk.red("Constraint failures:")}\n${contraintFailures}`;
    }
  } else if (err.name === "NetworkError") {
    message = `${chalk.red("The query failed unexpectedly with the following error:")}\n\n${NETWORK_ERROR_MESSAGE}`;
  } else {
    message = `${chalk.red("The query failed unexpectedly with the following error:")}\n\n${err.message}`;
  }

  return message;
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
 * @param {object} opts
 * @param {import("fauna").FaunaError} opts.err - The Fauna error to handle
 * @param {(e: import("fauna").FaunaError) => void} [opts.handler] - Optional error handler to handle and throw in
 * @param {boolean} opts.color - Whether to colorize the error
 * @param {string[]} opts.include - The query info fields to include
 * @throws {Error} Always throws an error with a message based on the error code or handler response
 * @returns {never} This function always throws an error
 */

export const faunaToCommandError = ({ err, handler, color, include }) => {
  if (handler) {
    handler(err);
  }

  if (err instanceof ServiceError) {
    switch (err.code) {
      case "unauthorized":
        throw new AuthenticationError({ cause: err });
      case "forbidden":
        throw new AuthorizationError({ cause: err });
      case "permission_denied":
        throw new AuthorizationError({ cause: err });
      default:
        throw new CommandError(formatError(err, { color, include }), {
          cause: err,
        });
    }
  }

  if (err instanceof NetworkError) {
    throw new CommandError(NETWORK_ERROR_MESSAGE, { cause: err });
  }

  throw err;
};

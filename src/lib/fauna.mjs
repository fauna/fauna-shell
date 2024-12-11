//@ts-check
/**
 * @fileoverview Fauna V10 client utilities for query execution and error handling.
 */

import {
  ClientClosedError,
  ClientError,
  NetworkError,
  ProtocolError,
  ServiceError,
} from "fauna";

import { container } from "../cli.mjs";
import { ValidationError } from "./command-helpers.mjs";
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
 * @param {boolean} [opts.raw] - Whether to include full response bodies
 * @param {boolean} [opts.color] - Whether to colorize the error
 * @returns {string} The formatted error message
 */
export const formatError = (err, opts = {}) => {
  const { raw, color } = opts;

  // If the error has a queryInfo object with a summary property, we can format it.
  // Doing this check allows this code to avoid a fauna direct dependency.
  if (
    err &&
    typeof err.queryInfo === "object" &&
    typeof err.queryInfo.summary === "string"
  ) {
    // If you want full response, use util.inspect to get the full error object.
    if (raw) {
      return colorize(err, { color, format: Format.JSON });
    }

    // Otherwise, return the summary and fall back to the message.
    return colorize(
      `The query failed with the following error:\n\n${err.queryInfo?.summary ?? err.message}`,
      { color, format: Format.TEXT },
    );
  } else {
    return colorize(
      `The query failed unexpectedly with the following error:\n\n${err.message}`,
      { color, format: Format.TEXT },
    );
  }
};

/**
 * Formats a V10 Fauna query response.
 * @par [ am {import("fauna").QuerySuccess<any>} res
 * @param {object} [opts]
 * @param {boolean} [opts.raw] - Whether to include full response bodies
 * @param {string} [opts.format] - The format to use
 * @param {boolean} [opts.color] - Whether to colorize the response
 * @returns {string} The formatted response
 */
export const formatQueryResponse = (res, opts = {}) => {
  const { raw, format = Format.JSON, color } = opts;

  // If raw is set, return the full response object.
  const data = raw ? res : res.data;
  return colorize(data, { format, color });
};

/**
 * Error handler for errors thrown by the V10 driver. Custom handlers
 * can be provided for different types of errors, and a default error
 * message is thrown if no handler is provided. This may be used when we run
 * commands on the users behalf and want to provide a more helpful error message.
 *
 * @param {import("fauna").FaunaError} e - The Fauna error to handle
 * @param {object} [handlers] - Optional error handlers
 * @param {(e: ServiceError) => string} [handlers.onInvalidQuery] - Handler for invalid query errors
 * @param {(e: ServiceError) => string} [handlers.onInvalidRequest] - Handler for invalid request errors
 * @param {(e: ServiceError) => string} [handlers.onAbort] - Handler for aborted operation errors
 * @param {(e: ServiceError) => string} [handlers.onConstraintFailure] - Handler for constraint violation errors
 * @param {(e: ServiceError) => string} [handlers.onUnauthorized] - Handler for unauthorized access errors
 * @param {(e: ServiceError) => string} [handlers.onForbidden] - Handler for forbidden access errors
 * @param {(e: ServiceError) => string} [handlers.onContendedTransaction] - Handler for transaction contention errors
 * @param {(e: ServiceError) => string} [handlers.onLimitExceeded] - Handler for rate/resource limit errors
 * @param {(e: ServiceError) => string} [handlers.onTimeOut] - Handler for timeout errors
 * @param {(e: ServiceError) => string} [handlers.onInternalError] - Handler for internal server errors
 * @param {(e: ServiceError) => string} [handlers.onDocumentNotFound] - Handler for document not found errors
 * @param {(e: ClientError) => string} [handlers.onClientError] - Handler for general client errors
 * @param {(e: ClientClosedError) => string} [handlers.onClientClosedError] - Handler for closed client errors
 * @param {(e: NetworkError) => string} [handlers.onNetworkError] - Handler for network-related errors
 * @param {(e: ProtocolError) => string} [handlers.onProtocolError] - Handler for protocol-related errors
 * @throws {Error} Always throws an error with a message based on the error code or handler response
 * @returns {never} This function always throws an error
 */
// eslint-disable-next-line complexity
export const throwForError = (e, handlers = {}) => {
  if (e instanceof ServiceError) {
    switch (e.code) {
      case "invalid_query":
        throw new Error(handlers.onInvalidQuery?.(e) ?? formatError(e));
      case "invalid_request ":
        throw new Error(handlers.onInvalidRequest?.(e) ?? formatError(e));
      case "abort":
        throw new Error(handlers.onAbort?.(e) ?? formatError(e));
      case "constraint_failure":
        throw new Error(handlers.onConstraintFailure?.(e) ?? formatError(e));
      case "unauthorized":
        throw new Error(
          handlers.onUnauthorized?.(e) ??
            "Authentication failed: Please either log in using 'fauna login' or provide a valid database secret with '--secret'.",
        );
      case "forbidden":
        throw new Error(handlers.onForbidden?.(e) ?? formatError(e));
      case "contended_transaction":
        throw new Error(handlers.onContendedTransaction?.(e) ?? formatError(e));
      case "limit_exceeded":
        throw new Error(handlers.onLimitExceeded?.(e) ?? formatError(e));
      case "time_out":
        throw new Error(handlers.onTimeOut?.(e) ?? formatError(e));
      case "internal_error":
        throw new Error(handlers.onInternalError?.(e) ?? formatError(e));
      case "document_not_found":
        throw new Error(handlers.onDocumentNotFound?.(e) ?? formatError(e));
      default:
        throw e;
    }
  } else if (e instanceof ClientError) {
    throw new Error(handlers.onClientError?.(e) ?? formatError(e));
  } else if (e instanceof ClientClosedError) {
    throw new Error(handlers.onClientClosedError?.(e) ?? formatError(e));
  } else if (e instanceof NetworkError) {
    throw new Error(handlers.onNetworkError?.(e) ?? formatError(e));
  } else if (e instanceof ProtocolError) {
    throw new Error(handlers.onProtocolError?.(e) ?? formatError(e));
  } else {
    throw e;
  }
};

//@ts-check

import {
  Client,
  FaunaError,
  ServiceError,
  ClientError,
  ClientClosedError,
  NetworkError,
  ProtocolError,
} from "fauna";

/**
 * @type {import("fauna").QueryOptions}
 */
export const defaultV10QueryOptions = {
  format: "simple",
  typecheck: false,
};

/**
 * Creates a V10 Fauna client.
 *
 * @param {object} opts
 * @param {string} opts.url
 * @param {string} opts.secret
 * @returns {Promise<Client>}
 */
export const getV10Client = async ({ url, secret }) => {
  // Check for required arguments.
  if (!url || !secret) {
    throw new Error("A url and secret are required.");
  }
  // Create the client.
  return new Client({ secret, endpoint: new URL(url) });
};

/**
 * Runs a V10 Fauna query. A client may be provided, or a url
 * and secret may be used to create one.
 *
 * @param {object} opts
 * @param {import("fauna").Query<any>} opts.query
 * @param {string} [opts.url]
 * @param {string} [opts.secret]
 * @param {Client} [opts.client]
 * @param {object} [opts.options]
 * @returns {Promise<import("fauna").QuerySuccess<any>>}
 */
export const runV10Query = async ({
  query,
  url,
  secret,
  client,
  options = {},
}) => {
  // Check for required arguments.
  if (!query) {
    throw new Error("A query is required.");
  } else if (!client && (!url || !secret)) {
    throw new Error("A client or url and secret are required.");
  }

  // Create the client if one wasn't provided.
  let _client =
    client ??
    (await getV10Client({
      url: /** @type {string} */ (url), // We know this is a string because we check for !url above.
      secret: /** @type {string} */ (secret), // We know this is a string because we check for !secret above.
    }));

  // Run the query.
  return _client
    .query(query, { ...defaultV10QueryOptions, ...options })
    .finally(() => {
      // Clean up the client if one was created internally.
      if (!client && _client) _client.close();
    });
};

/**
 * Error handler for errors thrown by the V10 driver. Custom handlers
 * can be provided for different types of errors, and a default error
 * message is thrown if no handlers are provided.
 *
 * @param {FaunaError} e - The Fauna error to handle
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
 * @param {(e: ClientError) => string} [handlers.onClientError] - Handler for general client errors
 * @param {(e: ClientClosedError) => string} [handlers.onClientClosedError] - Handler for closed client errors
 * @param {(e: NetworkError) => string} [handlers.onNetworkError] - Handler for network-related errors
 * @param {(e: ProtocolError) => string} [handlers.onProtocolError] - Handler for protocol-related errors
 * @throws {Error} Always throws an error with a message based on the error code or handler response
 * @returns {never} This function always throws an error
 */
export const throwForV10Error = (e, handlers = {}) => {
  if (e instanceof ServiceError) {
    switch (e.code) {
      case "invalid_query":
        throw new Error(handlers.onInvalidQuery?.(e) ?? e.message);
      case "invalid_request ":
        throw new Error(handlers.onInvalidRequest?.(e) ?? e.message);
      case "abort":
        throw new Error(handlers.onAbort?.(e) ?? e.message);
      case "constraint_failure":
        throw new Error(handlers.onConstraintFailure?.(e) ?? e.message);
      case "unauthorized":
        throw new Error(
          handlers.onUnauthorized?.(e) ??
            "Authentication failed: Please either log in using 'fauna login' or provide a valid database secret with '--secret'",
        );
      case "forbidden":
        throw new Error(handlers.onForbidden?.(e) ?? e.message);
      case "contended_transaction":
        throw new Error(handlers.onContendedTransaction?.(e) ?? e.message);
      case "limit_exceeded":
        throw new Error(handlers.onLimitExceeded?.(e) ?? e.message);
      case "time_out":
        throw new Error(handlers.onTimeOut?.(e) ?? e.message);
      case "internal_error":
        throw new Error(handlers.onInternalError?.(e) ?? e.message);
      default:
        throw e;
    }
  } else if (e instanceof ClientError) {
    throw new Error(handlers.onClientError?.(e) ?? e.message);
  } else if (e instanceof ClientClosedError) {
    throw new Error(handlers.onClientClosedError?.(e) ?? e.message);
  } else if (e instanceof NetworkError) {
    throw new Error(handlers.onNetworkError?.(e) ?? e.message);
  } else if (e instanceof ProtocolError) {
    throw new Error(handlers.onProtocolError?.(e) ?? e.message);
  } else {
    throw e;
  }
};

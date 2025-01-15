// @ts-check
import { createContext, runInContext } from "node:vm";

import chalk from "chalk";
import faunadb from "faunadb";

import { container } from "../config/container.mjs";
import {
  AuthenticationError,
  AuthorizationError,
  CommandError,
  NETWORK_ERROR_MESSAGE,
} from "./errors.mjs";
import { colorize, Format } from "./formatting/colorize.mjs";

/**
 * Creates a V4 Fauna client.
 * @param {object} argv
 * @param {string} argv.url
 * @param {string} argv.secret
 * @param {number} [argv.timeout]
 * @returns {Promise<import("faunadb").Client>}
 */
export const getClient = async (argv) => {
  const { Client } = container.resolve("faunadb");
  const { hostname, port, protocol } = new URL(argv.url);
  const scheme = protocol?.replace(/:$/, "");

  return new Client({
    domain: hostname,
    port: Number(port),
    scheme: /** @type {('http'|'https')} */ (scheme),
    secret: argv.secret,
    timeout: argv.timeout,
    fetch: container.resolve("fetch"),
    headers: {
      "x-fauna-shell-builtin": "true",
      "x-fauna-source": "Fauna Shell",
    },
  });
};

/**
 * Interprets a string as a v4 FQL expression and returns a query.
 * @param {string} expression - The FQL expression to interpret
 * @returns {Promise<import("faunadb").Expr>} The resulting query
 */
export async function stringExpressionToQuery(expression) {
  const faunadb = (await import("faunadb")).default;
  return runInContext(expression, createContext(faunadb.query));
}

const validateQueryParams = ({ query, client, url, secret }) => {
  if (!query) {
    throw new Error("A query is required.");
  } else if (!client && (!url || !secret)) {
    throw new Error("A client or url and secret are required.");
  }
};

/**
 * Runs a V10 Fauna query. A client may be provided, or a url
 * and secret may be used to create one.
 *
 * @param {object} opts
 * @param {import("faunadb").ExprArg} opts.query
 * @param {string} [opts.url]
 * @param {string} [opts.secret]
 * @param {import("faunadb").Client} [opts.client]
 * @param {import("faunadb").QueryOptions} [opts.options]
 * @returns {Promise<any>}
 */
export const runQuery = async ({
  query,
  url = "",
  secret = "",
  client,
  options = {},
}) => {
  validateQueryParams({ query, client, url, secret });
  let _client = client ?? (await getClient({ url, secret }));

  try {
    return await _client.queryWithMetrics(query, options);
  } finally {
    if (!client && _client) {
      _client.close();
    }
  }
};

/**
 *
 * @param {object} response - The v4 query response with query info
 * @param {object} opts
 * @param {boolean} opts.color - Whether to colorize the error
 * @param {string[]} opts.include - The query info fields to include
 * @returns
 */
export const formatQueryInfo = (response, { color, include }) => {
  if (include && !include.includes("stats")) {
    return "";
  }

  const colorized = colorize(
    { stats: response.metrics },
    { color, format: Format.YAML },
  );

  return `${colorized}\n`;
};

/**
 * Formats a V4 Fauna error for display.
 * @param {any} err - An error to format
 * @param {object} opts
 * @param {boolean} opts.color - Whether to colorize the error
 * @param {string[]} opts.include - The query info fields to include
 * @returns {string} The formatted error message
 */
export const formatError = (err, { color, include }) => {
  let message = "";

  // By doing this we can avoid requiring a faunadb direct dependency
  if (
    err &&
    typeof err.requestResult === "object" &&
    typeof err.requestResult.responseContent === "object" &&
    Array.isArray(err.requestResult.responseContent.errors)
  ) {
    // Get query info from the response headers.
    const metricsHeaders = [
      "x-compute-ops",
      "x-byte-read-ops",
      "x-byte-write-ops",
      "x-query-time",
      "x-txn-retries",
    ];
    const metricsResponse = {
      metrics: Object.fromEntries(
        Array.from(Object.entries(err.requestResult.responseHeaders))
          .filter(([k]) => metricsHeaders.includes(k))
          .map(([k, v]) => [k, parseInt(v)]),
      ),
    };
    const queryInfo = formatQueryInfo(metricsResponse, { color, include });

    message = queryInfo === "" ? "" : `${queryInfo}\n`;

    const subMessages = [];
    err.requestResult.responseContent.errors.forEach(
      ({ code, description, position }) => {
        // add `*query*` so it looks more like the v10 error summaries.
        const summary = `${code}: ${description}\nat *query*:${position.join(", ")}`;
        let subMessage = `${chalk.red("The query failed with the following error:")}\n\n${summary}`;
        subMessages.push(subMessage);
      },
    );

    message += subMessages.join("\n\n");
  } else if (err.name === "TypeError" && err.message.includes("fetch failed")) {
    message = `${chalk.red("The query failed unexpectedly with the following error:")}\n\n${NETWORK_ERROR_MESSAGE}`;
  } else {
    message = `${chalk.red("The query failed unexpectedly with the following error:")}\n\n${err.message}`;
  }

  return message;
};

/**
 * Converts a Fauna HTTP error to a CommandError.
 * @param {object} opts
 * @param {any} opts.err - The error to convert
 * @param {(e: import("fauna").FaunaError) => void} [opts.handler] - Optional error handler to handle and throw in
 * @param {boolean} opts.color - Whether to colorize the error
 * @param {string[]} opts.include - The query info fields to include
 * @returns {void}
 */
export const faunadbToCommandError = ({ err, handler, color, include }) => {
  if (handler) {
    handler(err);
  }

  if (err instanceof faunadb.errors.FaunaHTTPError) {
    switch (err.name) {
      case "Unauthorized":
        throw new AuthenticationError({ cause: err });
      case "PermissionDenied":
        throw new AuthorizationError({ cause: err });
      case "BadRequest":
      case "NotFound":
        throw new CommandError(formatError(err, { color, include }), {
          cause: err,
        });
      default:
        throw err;
    }
  }

  if (err.name === "TypeError" && err.message.includes("fetch failed")) {
    throw new CommandError(NETWORK_ERROR_MESSAGE, { cause: err });
  }

  throw err;
};

/**
 * Formats a V4 Fauna query response.
 * @param {any} res - The query response to format
 * @param {object} [opts]
 * @param {boolean} [opts.json] - Whether to return the response as a JSON string
 * @param {boolean} [opts.color] - Whether to colorize the response
 * @param {string} [opts.format] - The format to use for the response
 * @returns {string} The formatted response
 */
export const formatQueryResponse = (res, opts = {}) => {
  const { color, format } = opts;
  const data = res.value;
  const resolvedFormat = format ?? Format.JSON;
  return colorize(data, { format: resolvedFormat, color });
};

/**
 * Runs a V4 Fauna query from a string expression.
 * @param {object} opts
 * @param {string} opts.expression - The FQL expression to interpret
 * @param {string} [opts.url]
 * @param {string} [opts.secret]
 * @param {import("faunadb").Client} [opts.client]
 * @param {import("faunadb").QueryOptions} [opts.options]
 * @returns {Promise<any>}
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

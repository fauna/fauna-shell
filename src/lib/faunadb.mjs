// @ts-check
import util from "node:util";
import { createContext, runInContext } from "node:vm";

import { container } from "../cli.mjs";

/**
 * Creates a V4 Fauna client.
 * @param {object} argv
 * @param {string} argv.url
 * @param {string} argv.secret
 * @param {number} [argv.timeout]
 * @returns {Promise<import("faunadb").Client>}
 */
export const getV4Client = async (argv) => {
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
    }
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
export const runV4Query = async ({
  query,
  url = "",
  secret = "",
  client,
  options = {},
}) => {
  validateQueryParams({ query, client, url, secret });
  let _client = client ?? await getV4Client({ url, secret });
 
  try {
    return await _client.queryWithMetrics(query, options);
  } finally {
    if (!client && _client) {
      _client.close();
    }
  }
};

/**
 * Formats a V4 Fauna error for display.
 * @param {import("faunadb").errors.FaunaError} err - The Fauna error to format
 * @param {object} [opts]
 * @param {boolean} [opts.extra] - Whether to include extra information
 * @returns {string} The formatted error message
 */
export const formatV4Error = (err, opts = {}) => {
  const { extra } = opts;
  const { errors } = container.resolve("faunadb");

  if (err instanceof errors.FaunaHTTPError) {
    // If extra is on, return the full error.
    if (extra) {
      return util.inspect(err, { depth: null, compact: false });
    }
    
    const { errors } = JSON.parse(err.requestResult.responseRaw)
    if (!errors) {
      return err.message;
    }

    const messages = [];
    errors.forEach(({ code, description, position }) => {
       messages.push(`${code}: ${description} at ${position.join(', ')}\n`);
    });

    return messages.join('\n').trim();
  }
  
  return err.message;
};

/**
 * Formats a V4 Fauna query response.
 * @param {any} res - The query response to format
 * @param {object} [opts]
 * @param {boolean} [opts.extra] - Whether to include extra information
 * @param {boolean} [opts.json] - Whether to return the response as a JSON string
 * @returns {string} The formatted response
 */
export const formatV4QueryResponse = (res, opts = {}) => {
  const { extra, json } = opts;
  const data = extra ? res : res.value;
  if (json) {
    return JSON.stringify(data);
  }

  return JSON.stringify(data, null, 2);
}

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
export const runV4QueryFromString = async ({
  expression,
  url,
  secret,
  client,
  options = {},
}) => {
  const query = await stringExpressionToQuery(expression);
  return runV4Query({ query, url, secret, client, options });
};
//@ts-check

import { container } from "../cli.mjs";

export default class FaunaClient {
  // : { endpoint: string; secret: string; timeout?: number }
  constructor(opts) {
    this.endpoint = opts.endpoint;
    this.secret = opts.secret;
    this.timeout = opts.timeout;
  }

  // query<T>(query: string, opts?: format?: string; typecheck?: boolean; secret?: string;
  // returns Promise<QueryResponse<T>>
  // eslint-disable-next-line complexity
  async query(query, opts) {
    const fetch = container.resolve("fetch");

    const { format, typecheck, secret } = {
      format: opts?.format ?? "simple",
      typecheck: opts?.typecheck ?? undefined,
      secret: opts?.secret ?? this.secret,
    };
    const url = new URL(this.endpoint);
    url.pathname = "/query/1";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret ?? this.secret}`,
        "x-fauna-source": "Fauna Shell",
        ...(typecheck !== undefined && {
          "x-typecheck": typecheck.toString(),
        }),
        ...(format !== undefined && { "x-format": format }),
        ...((this.timeout && {
          "x-query-timeout-ms": this.timeout.toString(10),
        }) ??
          {}),
      },
      body: JSON.stringify({ query }),
    });

    const json = await response.json();

    if (response.status === 200 || response.status === 201) {
      return {
        status: 200,
        body: json,
      };
    } else {
      return {
        status: response.status,
        body: {
          summary: json.summary,
          error: {
            code: json.error?.code,
            message: json.error?.message,
          },
        },
      };
    }
  }

  /**
   * We have two different clients, 1 for v10 and 1 for v4.  The v4 client requires closing
   * In order to allow commands to just close their client without having to worry about which
   * client they received, adding this noop method here.
   */
  // eslint-disable-next-line class-methods-use-this
  async close() {
    return undefined;
  }
}

/**
 * Gets a secret for the current credentials.
 * @return {Promise<string>} the secret
 */
export async function getSecret() {
  const credentials = container.resolve("credentials");
  if (!credentials.databaseKeys.key) {
    return await credentials.databaseKeys.getOrRefreshKey();
  }
  return credentials.databaseKeys.key;
}

export const retryInvalidCredsOnce = async (initialSecret, fn) => {
  try {
    return await fn(initialSecret);
  } catch (err) {
    // If it's a 401, we need to refresh the secret. Let's just do type narrowing here
    // vs doing another v4 vs v10 check.
    if (
      err &&
      (err.httpStatus === 401 || err.requestResult?.statusCode === 401)
    ) {
      const credentials = container.resolve("credentials");

      await credentials.databaseKeys.onInvalidCreds(err);
      const refreshedSecret = await credentials.databaseKeys.getOrRefreshKey();

      return fn(refreshedSecret);
    }
    throw err;
  }
};

/**
 * Runs a query from a string expression.
 * @param {string} expression - The FQL expression to interpret
 * @param {object} argv - The command-line arguments
 * @returns {Promise<any>}
 */
export const runQueryFromString = (expression, argv) => {
  const faunaV4 = container.resolve("faunaClientV4");
  const faunaV10 = container.resolve("faunaClientV10");

  if (argv.apiVersion === "4") {
    const { secret, url, timeout } = argv;
    return retryInvalidCredsOnce(secret, (secret) =>
      faunaV4.runQueryFromString({
        expression,
        secret,
        url,
        client: undefined,
        options: { queryTimeout: timeout },
      }),
    );
  } else {
    const { secret, url, timeout, ...rest } = argv;

    return retryInvalidCredsOnce(secret, (secret) =>
      faunaV10.runQueryFromString({
        expression,
        secret,
        url,
        client: undefined,
        // eslint-disable-next-line camelcase
        options: { query_timeout_ms: timeout, ...rest },
      }),
    );
  }
};

/**
 * Formats an error.
 * @param {object} err - The error to format
 * @param {object} opts
 * @param {string} opts.apiVersion - The API version
 * @param {boolean} opts.extra - Whether to include extra information
 * @param {boolean} opts.color - Whether to colorize the error
 * @returns {object}
 */
export const formatError = (err, { apiVersion, extra, color }) => {
  const faunaV4 = container.resolve("faunaClientV4");
  const faunaV10 = container.resolve("faunaClientV10");

  if (apiVersion === "4") {
    return faunaV4.formatError(err, { extra, color });
  } else {
    return faunaV10.formatError(err, { extra, color });
  }
};

/**
 * Formats a query response.
 * @param {object} res - The query response
 * @param {object} opts
 * @param {string} opts.apiVersion - The API version
 * @param {boolean} opts.extra - Whether to include extra information
 * @param {boolean} opts.json - Whether to format the response as JSON
 * @param {boolean} opts.color - Whether to colorize the response
 * @returns {object}
 */
export const formatQueryResponse = (
  res,
  { apiVersion, extra, json, color },
) => {
  const faunaV4 = container.resolve("faunaClientV4");
  const faunaV10 = container.resolve("faunaClientV10");

  if (apiVersion === "4") {
    return faunaV4.formatQueryResponse(res, { extra, json, color });
  } else {
    return faunaV10.formatQueryResponse(res, { extra, json, color });
  }
};

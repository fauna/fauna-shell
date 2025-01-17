//@ts-check

import { container } from "../config/container.mjs";
import { isUnknownError } from "./errors.mjs";
import { faunaToCommandError } from "./fauna.mjs";
import { faunadbToCommandError } from "./faunadb.mjs";
import { Format } from "./formatting/colorize.mjs";

/**
 * Gets a secret for the current credentials.
 * @return {Promise<string>} the secret
 */
export async function getSecret(argv) {
  if (argv.secret) {
    return argv.secret;
  }

  const credentials = container.resolve("credentials");
  return await credentials.getSecret();
}

export const retryInvalidCredsOnce = async (initialSecret, fn) => {
  try {
    return await fn(initialSecret);
  } catch (err) {
    // If it's a 401, we need to refresh the secret. Let's just do type narrowing here
    // vs doing another v4 vs v10 check.
    if (
      err &&
      (err.name === "unauthorized" ||
        err.httpStatus === 401 ||
        err.requestResult?.statusCode === 401)
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
    const {
      secret,
      url,
      timeout,
      format,
      performanceHints,
      maxAttempts,
      maxBackoff,
      ...rest
    } = argv;

    let apiFormat = "decorated";
    if (format === Format.JSON) {
      apiFormat = "simple";
    }

    return retryInvalidCredsOnce(secret, (secret) =>
      faunaV10.runQueryFromString({
        expression,
        secret,
        url,
        client: undefined,
        options: {
          /* eslint-disable camelcase */
          query_timeout_ms: timeout,
          performance_hints: performanceHints,
          max_attempts: maxAttempts,
          max_backoff: maxBackoff,
          /* eslint-enable camelcase */
          format: apiFormat,
          ...rest,
        },
      }),
    );
  }
};

/**
 * Formats an error.
 * @param {object} err - The error to format
 * @param {object} opts
 * @param {string} opts.apiVersion - The API version
 * @param {boolean} opts.color - Whether to colorize the error
 * @param {string[]} opts.include - The query info fields to include
 * @returns {string}
 */
export const formatError = (err, { apiVersion, color, include }) => {
  const faunaV4 = container.resolve("faunaClientV4");
  const faunaV10 = container.resolve("faunaClientV10");

  if (apiVersion === "4") {
    return faunaV4.formatError(err, { color, include });
  } else {
    return faunaV10.formatError(err, { color, include });
  }
};

/**
 * Check if a database can be queried based on the current arguments.
 * If it can't, it will throw an error.
 * @param {*} argv
 */
export const isQueryable = async (argv) => {
  const runQueryFromString = container.resolve("runQueryFromString");
  try {
    await runQueryFromString("1+1", argv);
  } catch (err) {
    // Three things can throw errors here. Stuff we know,
    // like authx, v10 errors, and v4 errors or stuff we don't know.
    if (!isUnknownError(err)) {
      throw err;
    }

    const { color, include } = argv;
    if (argv.apiVersion === "4") {
      faunadbToCommandError({ err, color, include });
    } else {
      faunaToCommandError({ err, color, include });
    }
  }

  return true;
};

/**
 * Formats a query response.
 * @param {object} res - The query response
 * @param {object} opts
 * @param {string} opts.apiVersion - The API version
 * @param {string} opts.format - The data format
 * @param {boolean} opts.color - Whether to colorize the response
 * @returns {string}
 */
export const formatQueryResponse = (res, { apiVersion, color, format }) => {
  if (apiVersion === "4") {
    const faunaV4 = container.resolve("faunaClientV4");
    return faunaV4.formatQueryResponse(res, { format, color });
  } else {
    const faunaV10 = container.resolve("faunaClientV10");
    return faunaV10.formatQueryResponse(res, { format, color });
  }
};

/**
 *
 * @param {object} response - The v4 or v10 query response with query info
 * @param {object} opts
 * @param {string} opts.apiVersion - The API version
 * @param {boolean} opts.color - Whether to colorize the error
 * @param {string[]} opts.include - The query info fields to include
 * @returns
 */
export const formatQueryInfo = (response, { apiVersion, color, include }) => {
  if (apiVersion === "4") {
    const faunaV4 = container.resolve("faunaClientV4");
    return faunaV4.formatQueryInfo(response, { color, include });
  } else {
    const faunaV10 = container.resolve("faunaClientV10");
    return faunaV10.formatQueryInfo(response, { color, include });
  }
};

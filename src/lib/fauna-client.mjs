//@ts-check

import { container } from "../cli.mjs";
import { ValidationError } from "./errors.mjs";
import { colorize, Format } from "./formatting/colorize.mjs";

const SUMMARY_FQL_REGEX = /^(\s\s\|)|(\d\s\|)/;

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
    const { secret, url, timeout, format, performanceHints, raw, ...rest } =
      argv;
    let apiFormat = "decorated";
    if (format === Format.JSON) {
      apiFormat = "simple";
    }

    return retryInvalidCredsOnce(secret, (secret) =>
      faunaV10.runQueryFromString({
        expression,
        url,
        secret,
        raw,
        options: {
          /* eslint-disable camelcase */
          query_timeout_ms: timeout,
          performance_hints: performanceHints,
          /* eslint-enable camelcase */
          format: apiFormat,
          ...rest,
        },
      }),
    );
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
    throw new ValidationError(err.message, { cause: err });
  }
};

/**
 * Formats an error.
 * @param {object} err - The error to format
 * @param {object} opts
 * @param {string} opts.apiVersion - The API version
 * @param {boolean} opts.raw - Whether to include full response bodies
 * @param {boolean} opts.color - Whether to colorize the error
 * @returns {string}
 */
export const formatError = (err, { apiVersion, raw, color }) => {
  const faunaV4 = container.resolve("faunaClientV4");
  const faunaV10 = container.resolve("faunaClientV10");

  if (apiVersion === "4") {
    return faunaV4.formatError(err, { raw, color });
  } else {
    return faunaV10.formatError(err, { raw, color });
  }
};

/**
 * Formats a query response.
 * @param {object} res - The query response
 * @param {object} opts
 * @param {string} opts.apiVersion - The API version
 * @param {string} opts.format - The data format
 * @param {boolean} opts.raw - Whether to include full response bodies
 * @param {boolean} opts.color - Whether to colorize the response
 * @returns {string}
 */
export const formatQueryResponse = (
  res,
  { apiVersion, raw, color, format },
) => {
  const faunaV4 = container.resolve("faunaClientV4");
  const faunaV10 = container.resolve("faunaClientV10");

  if (apiVersion === "4") {
    return faunaV4.formatQueryResponse(res, { raw, color });
  } else {
    return faunaV10.formatQueryResponse(res, { raw, format, color });
  }
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
      if (!line.match(SUMMARY_FQL_REGEX)) {
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

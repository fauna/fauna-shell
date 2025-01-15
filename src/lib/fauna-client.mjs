//@ts-check

import stripAnsi from "strip-ansi";

import { container } from "../config/container.mjs";
import { isUnknownError } from "./errors.mjs";
import { faunaToCommandError } from "./fauna.mjs";
import { faunadbToCommandError } from "./faunadb.mjs";
import { colorize, Format } from "./formatting/colorize.mjs";

/**
 * Regex to match the FQL diagnostic line.
 * @type {RegExp}
 */
export const FQL_DIAGNOSTIC_REGEX = /^(\s{2,}\|)|(\s*\d{1,}\s\|)/;

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
    const { secret, url, timeout, format, performanceHints, ...rest } = argv;
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
 * @returns {string}
 */
export const formatError = (err, { apiVersion, color }) => {
  const faunaV4 = container.resolve("faunaClientV4");
  const faunaV10 = container.resolve("faunaClientV10");

  if (apiVersion === "4") {
    return faunaV4.formatError(err, { color });
  } else {
    return faunaV10.formatError(err, { color });
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

    const { color } = argv;
    if (argv.apiVersion === "4") {
      faunadbToCommandError({ err, color });
    } else {
      faunaToCommandError({ err, color });
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
  const faunaV4 = container.resolve("faunaClientV4");
  const faunaV10 = container.resolve("faunaClientV10");

  if (apiVersion === "4") {
    return faunaV4.formatQueryResponse(res, { format, color });
  } else {
    return faunaV10.formatQueryResponse(res, { format, color });
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
 * @param {object} response - The v4 or v10 query response with query info
 * @param {object} opts
 * @param {string} opts.apiVersion - The API version
 * @param {boolean} opts.color - Whether to colorize the error
 * @param {string[]} opts.include - The query info fields to include
 * @returns
 */
export const formatQueryInfo = (response, { apiVersion, color, include }) => {
  if (apiVersion === "4" && include.includes("stats")) {
    /** @type {import("faunadb").MetricsResponse} */
    const metricsResponse = response;
    const colorized = colorize(
      { metrics: metricsResponse.metrics },
      { color, format: Format.YAML },
    );

    return `${colorized}\n`;
  } else if (apiVersion === "10") {
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
  }

  return "";
};

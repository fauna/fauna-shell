//@ts-check

import { container } from "../cli.mjs";
import { ValidationError } from "./errors.mjs";
import { Format } from "./formatting/colorize.mjs";

const COMMON_OPTIONS = {
  // hidden
  "account-url": {
    type: "string",
    description: "the Fauna account URL to query",
    default: "https://account.fauna.com",
    hidden: true,
  },
  "client-id": {
    type: "string",
    description: "the client id to use when calling Fauna",
    required: false,
    hidden: true,
  },
  "client-secret": {
    type: "string",
    description: "the client secret to use when calling Fauna",
    required: false,
    hidden: true,
  },
};

// used for queries customers can't configure that are made on their behalf
const COMMON_QUERY_OPTIONS = {
  user: {
    alias: "u",
    type: "string",
    description:
      "User used to run the command. You must first log in as the user using `fauna login`.",
    default: "default",
    group: "API:",
  },
  local: {
    type: "boolean",
    describe:
      'Use a local Fauna container. If not otherwise specified, sets `--url` to http://localhost:8443 and `--secret` to "secret".',
    default: false,
    group: "API:",
  },
  url: {
    type: "string",
    description:
      "URL for Fauna Core HTTP API requests made by the command. Defaults to https://db.fauna.com.",
    group: "API:",
  },
  secret: {
    type: "string",
    description:
      "Authentication secret for Fauna Core HTTP API requests made by the command. Mutually exclusive with `--database` and `--role`.",
    required: false,
    group: "API:",
  },
  "account-key": {
    type: "string",
    description:
      "Fauna account key used for authentication. Negates the need for a user login. The key is used to generate short-lived database secrets for the CLI. Mutually exclusive with `--user` and `--secret`.",
    required: false,
    group: "API:",
  },
  database: {
    alias: "d",
    type: "string",
    description:
      "Path, including Region Group identifier and hierarchy, for the database to run the command in. Mutually exclusive with `--secret`.",
    group: "API:",
  },
  role: {
    alias: "r",
    type: "string",
    description:
      "Role used to run the command. Mutually exclusive with `--secret`.",
    group: "API:",
  },
};

// used for queries customers can configure
const COMMON_CONFIGURABLE_QUERY_OPTIONS = {
  ...COMMON_QUERY_OPTIONS,
  "api-version": {
    description: "FQL version to use.",
    type: "string",
    alias: "v",
    default: "10",
    choices: ["4", "10"],
    group: "API:",
  },
  // v10 specific options
  format: {
    type: "string",
    alias: "f",
    description:
      "Output format for the query. When present, --json takes precedence over --format. Only applies to v10 queries.",
    choices: [Format.FQL, Format.JSON],
    default: Format.FQL,
    group: "API:",
  },
  typecheck: {
    type: "boolean",
    description:
      "Enable typechecking. Defaults to the typechecking setting of the database.",
    default: undefined,
    group: "API:",
  },
  timeout: {
    type: "number",
    description:
      "Maximum runtime, in milliseconds, for Fauna Core HTTP API requests made by the command.",
    default: 5000,
    group: "API:",
  },
  summary: {
    type: "boolean",
    description:
      "Output the summary field of the API response or nothing when it's empty. Only applies to v10 queries.",
    default: false,
    group: "API:",
  },
  "performance-hints": {
    type: "boolean",
    description:
      "Output the performance hints for the current query or nothing when no hints are available. Only applies to v10 queries.",
    default: false,
    group: "API:",
  },
};

export function yargsWithCommonQueryOptions(yargs) {
  return yargsWithCommonOptions(yargs, COMMON_QUERY_OPTIONS);
}

export function yargsWithCommonConfigurableQueryOptions(yargs) {
  return yargsWithCommonOptions(yargs, COMMON_CONFIGURABLE_QUERY_OPTIONS);
}

export function yargsWithCommonOptions(yargs, options) {
  return yargs.options({ ...options, ...COMMON_OPTIONS });
}

export const resolveFormat = (argv) => {
  const logger = container.resolve("logger");

  if (argv.json) {
    logger.debug(
      "--json has taken precedence over other formatting options, using JSON output",
      "argv",
    );
    return Format.JSON;
  }

  return argv.format;
};

/**
 * Validate that the user has specified either a database or a secret.
 * This check is not required for commands that can operate at a
 * "root" level.
 *
 * @param {object} argv
 * @param {string} argv.database - The database to use
 * @param {string} argv.secret - The secret to use
 * @param {boolean} argv.local - Whether to use a local Fauna container
 * @param {boolean|undefined} argv.getYargsCompletions - Whether this CLI run is to generate completions
 */
export const validateDatabaseOrSecret = (argv) => {
  // don't validate completion invocations
  if (argv.getYargsCompletions) return true;

  if (!argv.database && !argv.secret && !argv.local) {
    throw new ValidationError(
      "No database or secret specified. Please use either --database, --secret, or --local to connect to your desired Fauna database.",
    );
  }
  return true;
};

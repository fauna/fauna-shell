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
      "CLI user to run the command as. You must first log in as the user using 'fauna login'.",
    default: "default",
    group: "API:",
  },
  local: {
    type: "boolean",
    describe:
      "Use a local Fauna container. Sets --url to 'http://0.0.0.0:8443' and --secret to 'secret'.",
    default: false,
    group: "API:",
  },
  url: {
    type: "string",
    description:
      "URL for Core HTTP API requests made by the command. Defaults to https://db.fauna.com.",
    group: "API:",
  },
  secret: {
    type: "string",
    description:
      "Secret used for authentication. Can't be used with --database or --role.",
    required: false,
    group: "API:",
  },
  "account-key": {
    type: "string",
    description:
      "Fauna account key used for authentication. Can't be used with --user or --secret.",
    required: false,
    group: "API:",
  },
  database: {
    alias: "d",
    type: "string",
    description:
      "Database, including Region Group and hierarchy, to run the command in. Ex: 'us/my_db', 'eu/parent_db/child_db', 'global/db'. Can't be used with --secret.",
    group: "API:",
  },
  role: {
    alias: "r",
    type: "string",
    description: "Role used to run the command. Can't be used with --secret.",
    group: "API:",
  },
};

export const QUERY_INFO_CHOICES = [
  "txnTs",
  "schemaVersion",
  "summary",
  "queryTags",
  "stats",
];

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
      "Maximum query runtime in milliseconds. Only applies to v10 queries.",
    default: 5000,
    group: "API:",
  },
  "performance-hints": {
    type: "boolean",
    description:
      "Output performance hints. Sets --include summary. Only applies to v10 queries. If no performance hints are returned, no hints are output.",
    default: false,
    group: "API:",
  },
  include: {
    type: "array",
    choices: ["all", "none", ...QUERY_INFO_CHOICES],
    default: ["summary"],
    describe:
      "Query response info to output. Pass values as a space-separated list. Ex: --include summary queryTags.",
  },
};

export function yargsWithCommonQueryOptions(yargs) {
  return yargsWithCommonOptions(yargs, COMMON_QUERY_OPTIONS);
}

export function yargsWithCommonConfigurableQueryOptions(yargs) {
  return yargsWithCommonOptions(
    yargs,
    COMMON_CONFIGURABLE_QUERY_OPTIONS,
  ).middleware((argv) => {
    if (argv.include.includes("none")) {
      if (argv.include.length !== 1) {
        throw new ValidationError(
          `'--include none' cannot be used with other include options. Provided options: '${argv.include.join(", ")}'`,
        );
      }
      argv.include = [];
    }

    if (argv.include.includes("all")) {
      argv.include = [...QUERY_INFO_CHOICES];
    }

    if (argv.performanceHints && !argv.include.includes("summary")) {
      argv.include.push("summary");
    }
  });
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

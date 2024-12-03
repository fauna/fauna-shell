//@ts-check

// used for queries customers can't configure that are made on their behalf
const COMMON_QUERY_OPTIONS = {
  local: {
    type: 'boolean',
    describe: 'Use a local Fauna container. If not otherwise specified, sets `--url` to http://localhost:8443 and `--secret` to "secret".',
    default: false,
  },
  url: {
    type: "string",
    description: "URL for Fauna Core HTTP API requests made by the command. Defaults to https://db.fauna.com.",
  },
  secret: {
    type: "string",
    description: "Authentication secret for Fauna Core HTTP API requests made by the command. Mutually exclusive with `--database`.",
    required: false,
  },
  accountUrl: {
    type: "string",
    description: "the Fauna account URL to query",
    default: "https://account.fauna.com",
    hidden: true,
  },
  clientId: {
    type: "string",
    description: "the client id to use when calling Fauna",
    required: false,
    hidden: true,
  },
  clientSecret: {
    type: "string",
    description: "the client secret to use when calling Fauna",
    required: false,
    hidden: true,
  },
  database: {
    alias: "d",
    type: "string",
    description: "Path, including Region Group identifier and hierarchy, for the database to run the command in. Mutually exclusive with `--secret`.",
  },
  role: {
    alias: "r",
    type: "string",
    description: "Role used to run the command. Mutually exclusive with `--secret`."
  },
};


/**
 * Validate that the user has specified either a database or a secret.
 * This check is not required for commands that can operate at a
 * "root" level.
 * @param {object} argv
 * @param {string} argv.database - The database to use
 * @param {string} argv.secret - The secret to use
 */
export const validateDatabaseOrSecret = (argv) => {
  if (!argv.database && !argv.secret && !argv.local) {
    throw new Error("No database or secret specified. Pass either --database, or --secret, or --local.");
  }
}

// used for queries customers can configure
const COMMON_CONFIGURABLE_QUERY_OPTIONS = {
  ...COMMON_QUERY_OPTIONS,
  apiVersion: {
    description: "FQL version to use.",
    type: "string",
    alias: "v",
    default: "10",
    choices: ["4", "10"],
  },
  // v10 specific options
  typecheck: {
    type: "boolean",
    description: "Enable typechecking. Defaults to the typechecking setting of the database.",
    default: undefined,
  },
  timeout: {
    type: "number",
    description: "Maximum runtime, in milliseconds, for Fauna Core HTTP API requests made by the command.",
    default: 5000,
  }
};

export function yargsWithCommonQueryOptions(yargs) {
  return yargsWithCommonOptions(yargs, COMMON_QUERY_OPTIONS);
}

export function yargsWithCommonConfigurableQueryOptions(yargs) {
  return yargsWithCommonOptions(yargs, COMMON_CONFIGURABLE_QUERY_OPTIONS);
}

function yargsWithCommonOptions(yargs, options) {
  return yargs
    .options({ ...options, });
}

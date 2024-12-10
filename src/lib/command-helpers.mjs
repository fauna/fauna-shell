//@ts-check

const COMMON_OPTIONS = {
  // hidden
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
  accountKey: {
    type: "string",
    description:
      "The key to use for calling the Fauna Account API. Providing an account key will negate the need for a user login. The key will be used to generate short-lived database secrets. Cannot be used with --user or --secret.",
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

/**
 * An error that is thrown by commands that is not a validation error, but
 * a known error state that should be communicated to the user.
 */
export class CommandError extends Error {
  /**
   * @param {string} message
   * @param {object} [opts]
   * @param {number} [opts.exitCode]
   * @param {boolean} [opts.hideHelp]
   * @param {Error} [opts.cause]
   */
  constructor(message, { exitCode = 1, hideHelp = true, cause } = {}) {
    super(message);
    this.exitCode = exitCode;
    this.hideHelp = hideHelp;
    this.cause = cause;
  }
}

/**
 * An error that is thrown when the user provides invalid input, but
 * isn't caught until command execution.
 */
export class ValidationError extends CommandError {
  /**
   * @param {string} message
   * @param {object} [opts]
   * @param {number} [opts.exitCode]
   * @param {boolean} [opts.hideHelp]
   * @param {Error} [opts.cause]
   */
  constructor(message, { exitCode = 1, hideHelp = false, cause } = {}) {
    super(message, { exitCode, hideHelp, cause });
  }
}

/**
 * Returns true if the error is an error potentially thrown by yargs
 * @param {Error} error
 * @returns {boolean}
 */
function isYargsError(error) {
  // Sometimes they are named YError. This seems to the case in middleware.
  if (error.name === "YError") {
    return true;
  }

  // Usage errors from yargs are thrown as plain old Error. The best
  // you can do is check for the message.
  if (
    error.message &&
    (error.message.startsWith("Unknown argument") ||
      error.message.startsWith("Missing required argument") ||
      error.message.startsWith("Unknown command"))
  ) {
    return true;
  }

  return false;
}

/**
 * Returns true if the error is not an error yargs or one we've thrown ourselves in a command
 * @param {Error} error
 * @returns {boolean}
 */
export function isUnknownError(error) {
  return !isYargsError(error) && !(error instanceof CommandError);
}

/**
 * Validate that the user has specified either a database or a secret.
 * This check is not required for commands that can operate at a
 * "root" level.
 *
 * @param {object} argv
 * @param {string} argv.database - The database to use
 * @param {string} argv.secret - The secret to use
 * @param {boolean} argv.local - Whether to use a local Fauna container
 */
export const validateDatabaseOrSecret = (argv) => {
  if (!argv.database && !argv.secret && !argv.local) {
    throw new ValidationError(
      "No database or secret specified. Please use either --database, --secret, or --local to connect to your desired Fauna database.",
    );
  }
  return true;
};

// used for queries customers can configure
const COMMON_CONFIGURABLE_QUERY_OPTIONS = {
  ...COMMON_QUERY_OPTIONS,
  apiVersion: {
    description: "FQL version to use.",
    type: "string",
    alias: "v",
    default: "10",
    choices: ["4", "10"],
    group: "API:",
  },
  // v10 specific options
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

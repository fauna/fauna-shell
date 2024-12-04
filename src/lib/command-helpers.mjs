//@ts-check

// used for queries customers can't config  ure that are made on their behalf
const COMMON_QUERY_OPTIONS = {
  local: {
    type: "boolean",
    describe:
      "Indicates a local Fauna container is being used. Sets the URL to http://localhost:8443 if --url is not provided. Use --url to set a custom url for your container.",
    default: false,
  },
  url: {
    type: "string",
    description: "the Fauna URL to query",
  },
  secret: {
    type: "string",
    description: "the secret to use when calling Fauna",
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
    description: "a database path, including region",
  },
  role: {
    alias: "r",
    type: "string",
    description: "a role",
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
      error.message.startsWith("Missing required argument"))
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
 * @param {object} argv 
 * @param {string} argv.database - The database to use
 * @param {string} argv.secret - The secret to use
 * @param {boolean} argv.local - Whether to use a local Fauna container
 */
export const validateDatabaseOrSecret = (argv) => {
  if (!argv.database && !argv.secret && !argv.local) {
    throw new ValidationError(
      "No database or secret specified. Pass either --database, or --secret, or --local.",
    );
  }
}

// used for queries customers can configure
const COMMON_CONFIGURABLE_QUERY_OPTIONS = {
  ...COMMON_QUERY_OPTIONS,
  apiVersion: {
    description: "which FQL version to use",
    type: "string",
    alias: "v",
    default: "10",
    choices: ["4", "10"],
  },
  // v10 specific options
  typecheck: {
    type: "boolean",
    description: "enable typechecking",
    default: undefined,
  },
  timeout: {
    type: "number",
    description: "connection timeout in milliseconds",
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

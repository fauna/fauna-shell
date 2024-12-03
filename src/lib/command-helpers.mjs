//@ts-check

// used for queries customers can't configure that are made on their behalf
const COMMON_QUERY_OPTIONS = {
  local: {
    type: 'boolean',
    describe: 'Indicates a local Fauna container is being used. Sets the URL to http://localhost:8443 if --url is not provided. Use --url to set a custom url for your container.',
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
    description: "a role"
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
    .options({ ...options, })
    .middleware((argv) => {
      if (!argv.url) {
        if (argv.local) {
          argv.url = 'http://localhost:8443';
        } else {
          argv.url = 'https://db.fauna.com';
        }
      }
      if (!argv.secret && argv.local) {
        argv.secret = "secret";
      }
    });
}

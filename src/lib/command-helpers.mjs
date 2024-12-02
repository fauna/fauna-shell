//@ts-check

import { container } from "../cli.mjs";

// TODO: update for yargs
function buildHeaders() {
  const headers = {
    "X-Fauna-Source": "Fauna Shell",
  };
  // if (!["ShellCommand", "EvalCommand"].includes(constructor.name)) {
  //   headers["x-fauna-shell-builtin"] = "true";
  // }
  return headers;
}

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
  if (!argv.database && !argv.secret) {
    throw new Error("No database or secret specified. Pass --database or --secret.");
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

/**
 * This function will return a v4 or v10 client based on the version provided in the argv.
 *   onInvalidCreds decides whether or not we retry or ask the user to re-enter their secret.
 * @param {*} argv
 * @returns { Promise<any> } - A Fauna client
 */
export async function getSimpleClient(argv) {
  const logger = container.resolve("logger");
  const credentials = container.resolve("credentials");
  let client = await buildClient(argv);
  const originalQuery = client.query.bind(client);

  const queryArgs = async (originalArgs) => {
    const queryValue = originalArgs[0];
    const queryOptions = {
      ...originalArgs[1],
      secret: await credentials.databaseKeys.getOrRefreshKey(),
    };
    return [queryValue, queryOptions];
  };

  client.query = async function (...args) {
    const updatedArgs = await queryArgs(args);
    return originalQuery(...updatedArgs).then(async (result) => {
      if (result.status === 401) {
        // Either refresh the db key or tell the user their provided key was bad
        logger.debug(
          "Invalid credentials for Fauna API Call, attempting to refresh",
          "creds",
        );
        await credentials.databaseKeys.onInvalidCreds();
        const updatedArgs = await queryArgs(args);
        return await originalQuery(...updatedArgs);
      }
      return result;
    });
  };

  return client;
}
/**
 * Build a client based on the command line options provided
 * @param {*} options - Options for building a driver or fetch client
 * @returns
 */
async function buildClient(options) {
  let client;
  if (options.version === "4") {
    const faunadb = (await import("faunadb")).default;
    const { Client } = faunadb;
    const { hostname, port, protocol } = new URL(options.url);
    const scheme = protocol?.replace(/:$/, "");
    client = new Client({
      domain: hostname,
      port: Number(port),
      scheme: /** @type {('http'|'https')} */ (scheme),
      secret: options.secret,
      timeout: options.timeout,

      fetch: fetch,

      headers: buildHeaders(),
    });
  } else {
    const FaunaClient = (await import("./fauna-client.mjs")).default;
    client = new FaunaClient({
      endpoint: options.url,
      secret: options.secret,
      timeout: options.timeout,
    });
  }
  return client;
}

export function yargsWithCommonQueryOptions(yargs) {
  return yargsWithCommonOptions(yargs, COMMON_QUERY_OPTIONS);
}

export function yargsWithCommonConfigurableQueryOptions(yargs) {
  return yargsWithCommonOptions(yargs, COMMON_CONFIGURABLE_QUERY_OPTIONS);
}

function yargsWithCommonOptions(yargs, options) {
  return yargs
    .options({ ...options, })
    .check((argv) => {
      // If --local is provided and --url is not, set the default URL for local
      if (!argv.url) {
        if (argv.local) {
          argv.url = 'http://localhost:8443';
        } else {
          argv.url = 'https://db.fauna.com';
        }
      }
      return true; // Validation passed
    });
}

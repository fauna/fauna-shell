//@ts-check

import { container } from "../cli.mjs";
import { getAccountKey, getDBKey, refreshDBKey } from "./auth/authNZ.mjs";

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

/**
 * This function will return a v4 or v10 client based on the version provided in the argv.
 * The client will be configured with a secret provided via:
 *  - command line flag
 *  - environment variable
 *  - stored in the credentials file
 * If provided via command line flag or env var, 401s from the client will show an error to the user.
 * If the secret is stored in the credentials file, the client will attempt to refresh the secret
 *  and retry the query.
 * @param {*} argv
 * @returns
 */
export async function getSimpleClient(argv) {
  const logger = container.resolve("logger");
  const { profile, secret } = argv;
  const accountKey = getAccountKey(profile).accountKey;
  if (secret) {
    logger.debug("Using Database secret from command line flag");
  } else if (process.env.FAUNA_SECRET) {
    logger.debug(
      "Using Database secret from FAUNA_SECRET environment variable",
    );
  }
  const secretSource = secret ? "command line flag" : "environment variable";
  const secretToUse = secret || process.env.FAUNA_SECRET;

  let client;
  if (secretToUse) {
    client = await buildClient(argv);
    const originalQuery = client.query.bind(client);
    client.query = async function (...args) {
      return originalQuery(...args).then(async (result) => {
        // If we fail on a user-provided secret, we should throw an error and not
        // attempt to refresh the secret
        if (result.status === 401) {
          throw new Error(
            `Secret provided by ${secretSource} is invalid. Please provide a different value`,
          );
        }
        return result;
      });
    };
  } else {
    logger.debug(
      "No secret provided, checking for stored secret in credentials file",
    );
    client = await clientFromStoredSecret({
      argv,
      accountKey,
    });
  }
  return client;
}

/**
 * Build a client where the secret isn't provided as a class argument, but is instead
 *  fetched from the credentials file during client.query
 * @param {*} param0
 * @returns
 */
async function clientFromStoredSecret({ argv, accountKey }) {
  const logger = container.resolve("logger");
  const { database: path, role } = argv;
  let client = await buildClient({
    ...argv,
    // client.query will handle getting/refreshing the secret
    secret: undefined,
  });
  const originalQuery = client.query.bind(client);
  client.query = async function (...args) {
    // Get latest stored secret for the requested path
    const existingSecret = getDBKey({ accountKey, path, role })?.secret;
    const newArgs = [args[0], { ...args[1], secret: existingSecret }];
    return originalQuery(...newArgs).then(async (result) => {
      if (result.status === 401) {
        logger.debug("stored secret is invalid, refreshing");
        // Refresh the secret, store it, and use it to try again
        const newSecret = await refreshDBKey(argv);
        const newArgs = [args[0], { ...args[1], secret: newSecret.secret }];
        const result = await originalQuery(...newArgs);
        return result;
      }
      return result;
    });
  };
  return client;
}

/**
 * Build a client based on the command line options provided
 * @param {*} argv
 * @returns
 */
async function buildClient(argv) {
  let client;
  if (argv.version === "4") {
    const faunadb = (await import("faunadb")).default;
    const { Client } = faunadb;
    const { hostname, port, protocol } = new URL(argv.url);
    const scheme = protocol?.replace(/:$/, "");
    client = new Client({
      domain: hostname,
      port: Number(port),
      scheme: /** @type {('http'|'https')} */ (scheme),
      secret: argv.secret,
      timeout: argv.timeout,

      fetch: fetch,

      headers: buildHeaders(),
    });
  } else {
    const FaunaClient = (await import("./fauna-client.mjs")).default;
    client = new FaunaClient({
      endpoint: argv.url,
      secret: argv.secret,
      timeout: argv.timeout,
    });
  }
  return client;
}

// export async function ensureDbScopeClient({ scope, version, argv }) {
//   const path = scope.split("/");

//   const { connectionOptions } = await getClient({ version: "4", argv });
//   const { hostname, port, protocol } = new URL(connectionOptions.url);

//   if (!connectionOptions.secret.allowDatabase) {
//     throw new Error(
//       "Cannot specify database with a secret that contains a database"
//     );
//   }

//   for (let i = 0; i < path.length; i++) {
//     const client = new Client({
//       domain: hostname,
//       port,
//       scheme: protocol?.replace(/:$/, ""),
//       secret: connectionOptions.secret.buildSecret(),

//       // See getClient.
//       fetch: fetch,

//       headers: _getHeaders(),
//     });
//     const exists = await client.query(q.Exists(q.Database(path[i])));
//     await client.close();

//     if (!exists) {
//       const fullPath = [
//         ...connectionOptions.secret.databaseScope,
//         ...path.slice(0, i + 1),
//       ];
//       throw new Error(`Database '${fullPath.join("/")}' doesn't exist`);
//     }

//     connectionOptions.secret.appendScope(path[i]);
//   }

//   return getClient({
//     dbScope: scope,
//     version,
//   });
// }

// used for queries customers can't configure that are made on their behalf
export const commonQueryOptions = {
  url: {
    type: "string",
    description: "the Fauna URL to query",
    default: "https://db.fauna.com:443",
  },
  secret: {
    type: "string",
    description: "the secret to use when calling Fauna",
    required: true,
  },
};

// used for queries customers can configure
export const commonConfigurableQueryOptions = {
  ...commonQueryOptions,
  // TODO: is this unused? i think it might be
  version: {
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
  },
  // format: {
  //   type: "string",
  //   description: "output format",
  //   default: "shell",
  //   options: EVAL_OUTPUT_FORMATS,
  // },
  // dbname: {
  //   type: "string",
  //   description: "the database to run the query against",
  // },
};

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

/**
 * This function will return a v4 or v10 client based on the version provided in the argv.
 *   onInvalidFaunaCreds decides whether or not we retry or ask the user to re-enter their secret.
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
      secret: await credentials.getOrRefreshDBKey(),
    };
    return [queryValue, queryOptions];
  };

  client.query = async function (...args) {
    const updatedArgs = await queryArgs(args);
    return originalQuery(...updatedArgs).then(async (result) => {
      // If we fail on a user-provided secret, we should throw an error and not
      // attempt to refresh the secret
      if (result.status === 401) {
        // Either refresh the db key in credentials singleton, or throw an error
        logger.debug(
          "Invalid credentials for Fauna API Call, attempting to refresh",
          "creds",
        );
        await credentials.onInvalidFaunaCreds();
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

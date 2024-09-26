const clients = {};
import faunadb from "faunadb";
const { Client, errors, query: q } = faunadb
import FaunaClient from "./fauna-client.js";
import { Secret } from "./secret.js"

/**
  * This is used to determine if the command should log the connection info.
  * We currently want to avoid doing this for eval since it can lead to the
  * response not being JSON parseable.
  */
  const outputConnectionInfo = true;

function success(msg) {
  const bang = green(process.platform === "win32" ? "»" : "›");
  console.info(` ${bang}   Success: ${msg}`);
}

function _getHeaders() {
  const headers = {
    "X-Fauna-Source": "Fauna Shell",
  };
  if (!["ShellCommand", "EvalCommand"].includes(constructor.name)) {
    headers["x-fauna-shell-builtin"] = "true";
  }
  return headers;
}

/**
  * !!! use getClient instead
  * Runs the function in the context of a database connection.
  *
  * @param {function} f       - The function to run
  * @param {string}   dbScope - The database in which the function will be executed.
  * @param {string}   role    - The user role with which the function will be executed.
  */
  async function withClient(f, dbScope, role) {
    let connectionOptions;
    try {
      connectionOptions = shellConfig.lookupEndpoint({
        scope: dbScope,
      });

      const { hostname, port, protocol } = new URL(connectionOptions.url);

      const client = new Client({
        domain: hostname,
        port,
        scheme: protocol?.replace(/:$/, ""),
        secret: connectionOptions.secret.buildSecret({ role }),

        // Force http1. See getClient.
        fetch: fetch,

        headers: _getHeaders(),
      });
      await client.query(q.Now());
      //TODO this should return a Promise
      return f(client, connectionOptions);
    } catch (err) {
      mapConnectionError({ err, connectionOptions });
    }
  }

function mapConnectionError({ err, connectionOptions }) {
  if (err instanceof errors.Unauthorized) {
    throw new Error(
      `Could not Connect to ${connectionOptions.url} Unauthorized Secret`
    );
  } else {
    const code = err?.message ? `${err.message}: ` : "";
    const details = err?.description ?? "";
    err.message = `${code}${details}`
    throw err
    // throw new Error();
  }
}

export async function getSimpleClient(argv) {
  let client
  if (argv.version === '4') {
    const { hostname, port, protocol } = new URL(argv.url);
    client = new Client({
      domain: hostname,
      port,
      scheme: protocol?.replace(/:$/, ""),
      secret: argv.secret,
      timeout: argv.timeout,

      // Force http1. Fixes tests I guess? I spent a solid 30 minutes
      // debugging the whole `nock` thing in our tests, only to realize this
      // `fetch` key wasn't set after switching to the new config parsing.
      //
      // TODO: Remove and just connect to a docker container.
      fetch: fetch,

      headers: _getHeaders(),
    });

    // validate the client settings
    await client.query(q.Now());
  } else {
    client = new FaunaClient({
      endpoint: argv.url,
      secret: argv.secret,
      timeout: argv.timeout,
    });

    // validate the client settings
    await client.query("0");
  }

  return client
}

export async function getClient({ dbScope, role, version, argv } = {}) {
  const logConnectionMessage = (connectionOptions) => {
    if (outputConnectionInfo) {
      let connectedMessage;
      if (connectionOptions.name !== undefined) {
        connectedMessage = `Connected to endpoint: ${connectionOptions.name}`;
        if (connectionOptions.secret.databaseScope.length > 0) {
          connectedMessage += ` database: ${connectionOptions.secret.databaseScope.join(
            "/"
          )}`;
        }
      } else if (connectionOptions.secret.databaseScope?.length > 0) {
        connectedMessage = `Connected to database: ${connectionOptions.secret.databaseScope.join(
          "/"
        )}`;
      }
      if (connectedMessage !== undefined) {
        log(connectedMessage);
      }
    }
  };

  if (version === "4") {
    // construct v4 client
    let connectionOptions;
    try {
      connectionOptions = { url: "https://db.fauna.com:443", secret: new Secret({ key: "", allowDatabase: true, databaseScope: [] })}

      const { hostname, port, protocol } = new URL(connectionOptions.url);

      const client = new Client({
        domain: hostname,
        port,
        scheme: protocol?.replace(/:$/, ""),
        secret: connectionOptions.secret.buildSecret({ role }),
        timeout: argv.timeout,

        // Force http1. Fixes tests I guess? I spent a solid 30 minutes
        // debugging the whole `nock` thing in our tests, only to realize this
        // `fetch` key wasn't set after switching to the new config parsing.
        //
        // TODO: Remove and just connect to a docker container.
        fetch: fetch,

        headers: _getHeaders(),
      });

      // validate the client settings
      await client.query(q.Now());

      const hashKey = [dbScope, role].join("_");
      clients[hashKey] = { client, connectionOptions };
      logConnectionMessage(connectionOptions);
      return clients[hashKey];
    } catch (err) {
      mapConnectionError({ err, connectionOptions });
    }
  } else {
    // construct v10 client
    let connectionOptions;
    try {
      connectionOptions = { url: "https://db.fauna.com:443", secret: ""}
      const client = new FaunaClient({
        endpoint: connectionOptions.url,
        secret: "",
        timeout: argv.timeout
      });

      // validate the client settings
      await client.query("0");

      const hashKey = [dbScope, role].join("_");
      clients[hashKey] = {
        client,
        connectionOptions,
      };
      logConnectionMessage(connectionOptions);
      return clients[hashKey];
    } catch (err) {
      mapConnectionError({ err, connectionOptions });
    }
  }
}

export async function ensureDbScopeClient({ scope, version, argv }) {
  const path = scope.split("/");

  const { connectionOptions } = await getClient({ version: "4", argv });
  const { hostname, port, protocol } = new URL(connectionOptions.url);

  if (!connectionOptions.secret.allowDatabase) {
    throw new Error(
      "Cannot specify database with a secret that contains a database"
    );
  }

  for (let i = 0; i < path.length; i++) {
    const client = new Client({
      domain: hostname,
      port,
      scheme: protocol?.replace(/:$/, ""),
      secret: connectionOptions.secret.buildSecret(),

      // See getClient.
      fetch: fetch,

      headers: _getHeaders(),
    });
    const exists = await client.query(q.Exists(q.Database(path[i])));
    await client.close();

    if (!exists) {
      const fullPath = [
        ...connectionOptions.secret.databaseScope,
        ...path.slice(0, i + 1),
      ];
      throw new Error(`Database '${fullPath.join("/")}' doesn't exist`);
    }

    connectionOptions.secret.appendScope(path[i]);
  }

  return getClient({
    dbScope: scope,
    version,
  });
}

/**
  * Runs the provided query, while logging a message before running it.
  * Calls the success callback on success, or the failure one otherwise.
  *
  * @param {query}    queryExpr - The Query to execute.
  * @param {string}   logMsg    - The message to display before executing the query.
  * @param {function} success   - On success callback.
  * @param {function} failure   - On error callback.
  */
  function query(queryExpr, logMsg, success, failure) {
    return withClient((client, _) => {
      log(logMsg);
      return client.query(queryExpr).then(success).catch(failure);
    });
  }

function dbExists(dbName, callback) {
  return withClient((testDbClient, _) =>
    testDbClient.query(q.Exists(q.Database(dbName))).then(callback)
  );
}

/**
  * These flags allow the user to override endpoint configuration.
  * They are inherited by all shell commands that extend FaunaCommand.
  * See each command's flags to see how this mechanism works.
  */
  // FaunaCommand.flags = {
    //   ...Command.flags,
    //   domain: Flags.string({
      //     description: "Fauna server domain",
      //     // Emits a warning if this flag is used.
      //     deprecated: { to: "url" },
      //     // Hides the flag in `--help`
      //     hidden: true,
      //   }),
    //   scheme: Flags.string({
      //     description: "Connection scheme",
      //     options: ["https", "http"],
      //     deprecated: { to: "url" },
      //     hidden: true,
      //   }),
    //   port: Flags.string({
      //     description: "Connection port",
      //     deprecated: { to: "url" },
      //     hidden: true,
      //   }),
    //   url: Flags.string({
      //     description: "Database URL. Overrides the `url` in ~/.fauna-shell",
      //   }),
    //   timeout: Flags.string({
      //     description: "Connection timeout in milliseconds",
      //   }),
    //   secret: Flags.string({
      //     description: "Secret key. Overrides the `secret` in ~/.fauna-shell",
      //   }),
    //   endpoint: Flags.string({
      //     description: "Connection endpoint, from ~/.fauna-shell",
      //   }),
    //   environment: Flags.string({
      //     description: "Environment to use, from a Fauna project",
      //   }),
    // };

// export default FaunaCommand;

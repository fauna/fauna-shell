import { Command, Flags } from "@oclif/core";
import { lookupEndpoint } from "./config";
import { stringifyEndpoint } from "./misc";
import { query as q, errors, Client } from "faunadb";
import { green } from "chalk";
import FaunaClient from "./fauna-client.js";
import fetch from "node-fetch";

/**
 * This is the base class for all fauna-shell commands.
 */
class FaunaCommand extends Command {
  clients = {};

  /**
   * During init we parse the flags and arguments and assign them
   * to the `flags` and `args` member variables.
   *
   * We call `this.parse(this.constructor)` because we need to load
   * flags and args for the command being run in the CLI.
   * In this way we parse the flags and args defined in that command,
   * plus the ones defined here. A command then needs to define its flags
   * as follows, if it wants to inherit the flags defined in FaunaCommand:
   *
   * CreateKeyCommand.flags = {
   *        ...FaunaCommand.flags
   * }
   *
   */
  async init() {
    const { flags: f, args: a } = await this.parse(this.constructor);
    this.flags = f;
    this.args = a;
  }

  success(msg) {
    const bang = green(process.platform === "win32" ? "»" : "›");
    console.info(` ${bang}   Success: ${msg}`);
  }

  error(message) {
    super.error(message, { exit: 1 });
  }

  /**
   * !!! use getClient instead
   * Runs the function in the context of a database connection.
   *
   * @param {function} f       - The function to run
   * @param {string}   dbScope - The database in which the function will be executed.
   * @param {string}   role    - The user role with which the function will be executed.
   */
  async withClient(f, dbScope, role) {
    let connectionOptions;
    try {
      connectionOptions = lookupEndpoint(this.flags, dbScope, role);

      const { hostname, port, protocol } = new URL(connectionOptions.url);

      const client = new Client({
        domain: hostname,
        port,
        scheme: protocol?.replace(/:$/, ""),
        secret: connectionOptions.secret,

        // Force http1. See getClient.
        fetch: fetch,

        headers: {
          "X-Fauna-Source": "Fauna Shell",
        },
      });
      await client.query(q.Now());
      //TODO this should return a Promise
      return f(client, connectionOptions);
    } catch (err) {
      return this.mapConnectionError({ err, connectionOptions });
    }
  }

  mapConnectionError({ err, connectionOptions }) {
    if (err instanceof errors.Unauthorized) {
      return this.error(
        `Could not Connect to ${stringifyEndpoint(
          connectionOptions
        )} Unauthorized Secret`
      );
    }
    return this.error(err);
  }

  async getClient({ dbScope, role, version } = {}) {
    if (version === "4" || version === undefined) {
      // construct v4 client
      let connectionOptions;
      try {
        connectionOptions = lookupEndpoint(this.flags, dbScope, role);

        const { hostname, port, protocol } = new URL(connectionOptions.url);

        const client = new Client({
          domain: hostname,
          port,
          scheme: protocol?.replace(/:$/, ""),
          secret: connectionOptions.secret,

          // Force http1. Fixes tests I guess? I spent a solid 30 minutes
          // debugging the whole `nock` thing in our tests, only to realize this
          // `fetch` key wasn't set after switching to the new config parsing.
          //
          // TODO: Remove and just connect to a docker container.
          fetch: fetch,

          headers: {
            "X-Fauna-Source": "Fauna Shell",
          },
        });

        // validate the client settings
        await client.query(q.Now());

        const hashKey = [dbScope, role].join("_");
        this.clients[hashKey] = { client, connectionOptions };
        return this.clients[hashKey];
      } catch (err) {
        return this.mapConnectionError({ err, connectionOptions });
      }
    } else {
      // construct v10 client
      let connectionOptions;
      try {
        connectionOptions = lookupEndpoint(this.flags, dbScope, role);
        const client = new FaunaClient(
          connectionOptions.url,
          connectionOptions.secret,
          this.flags.timeout ? parseInt(this.flags.timeout, 10) : undefined
        );

        // validate the client settings
        await client.query("0");

        const hashKey = [dbScope, role].join("_");
        this.clients[hashKey] = {
          client,
          connectionOptions,
        };
        return this.clients[hashKey];
      } catch (err) {
        return this.mapConnectionError({ err, connectionOptions });
      }
    }
  }

  async ensureDbScopeClient(dbname) {
    const { client } = await this.getClient();
    const exists = await client.query(q.Exists(q.Database(dbname)));
    if (!exists) {
      this.error(`Database '${dbname}' doesn't exist`);
    }

    return this.getClient({
      dbScope: dbname,
      role: "admin",
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
  query(queryExpr, logMsg, success, failure) {
    return this.withClient((client, _) => {
      this.log(logMsg);
      return client.query(queryExpr).then(success).catch(failure);
    });
  }

  dbExists(dbName, callback) {
    return this.withClient((testDbClient, _) =>
      testDbClient.query(q.Exists(q.Database(dbName))).then(callback)
    );
  }
}

/**
 * These flags allow the user to override endpoint configuration.
 * They are inherited by all shell commands that extend FaunaCommand.
 * See each command's flags to see how this mechanism works.
 */
FaunaCommand.flags = {
  ...Command.flags,
  domain: Flags.string({
    description: "Fauna server domain",
  }),
  scheme: Flags.string({
    description: "Connection scheme",
    options: ["https", "http"],
  }),
  port: Flags.string({
    description: "Connection port",
  }),
  timeout: Flags.string({
    description: "Connection timeout in milliseconds",
  }),
  secret: Flags.string({
    description: "Fauna secret key",
  }),
  endpoint: Flags.string({
    description: "Fauna server endpoint",
  }),
  graphqlHost: Flags.string({
    description: "The Fauna GraphQL API host",
  }),
  graphqlPort: Flags.string({
    description: "GraphQL port",
  }),
};

export default FaunaCommand;

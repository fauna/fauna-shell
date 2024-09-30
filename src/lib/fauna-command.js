import { Command, Flags } from "@oclif/core";
import { green } from "chalk";
import { Client, errors, query as q } from "faunadb";
import { ShellConfig } from "./config";
import { setHasColor } from "./color";
import FaunaClient from "./fauna-client";

/**
 * This is the base class for all fauna-shell commands.
 */
class FaunaCommand extends Command {
  clients = {};

  /**
   * This is used to determine if the command should log the connection info.
   * We currently want to avoid doing this for eval since it can lead to the
   * response not being JSON parseable.
   */
  outputConnectionInfo = true;

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
    this.shellConfig = ShellConfig.read(this.flags, this);

    setHasColor(this.flags.color);
  }

  success(msg) {
    const bang = green(process.platform === "win32" ? "»" : "›");
    console.info(` ${bang}   Success: ${msg}`);
  }

  error(message) {
    super.error(message, { exit: 1 });
  }

  _getHeaders() {
    const headers = {
      "X-Fauna-Source": "Fauna Shell",
    };
    if (!["ShellCommand", "EvalCommand"].includes(this.constructor.name)) {
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
  async withClient(f, dbScope, role) {
    let connectionOptions;
    try {
      connectionOptions = this.shellConfig.lookupEndpoint({
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

        headers: this._getHeaders(),
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
      this.error(
        `Could not Connect to ${connectionOptions.url} Unauthorized Secret`
      );
    } else {
      const code = err?.message ? `${err.message}: ` : "";
      const details = err?.description ?? "";
      this.error(`${code}${details}`);
    }
  }

  async getClient({ dbScope, role, version } = {}) {
    const logConnectionMessage = (connectionOptions) => {
      if (this.outputConnectionInfo) {
        let connectedMessage;
        if (connectionOptions.name !== undefined) {
          connectedMessage = `Connected to endpoint: ${connectionOptions.name}`;
          if (connectionOptions.secret.databaseScope.length > 0) {
            connectedMessage += ` database: ${connectionOptions.secret.databaseScope.join(
              "/"
            )}`;
          }
        } else if (connectionOptions.secret.databaseScope.length > 0) {
          connectedMessage = `Connected to database: ${connectionOptions.secret.databaseScope.join(
            "/"
          )}`;
        }
        if (connectedMessage !== undefined) {
          this.log(connectedMessage);
        }
      }
    };

    if (version === "4" || version === undefined) {
      // construct v4 client
      let connectionOptions;
      try {
        connectionOptions = this.shellConfig.lookupEndpoint({ scope: dbScope });

        const { hostname, port, protocol } = new URL(connectionOptions.url);

        const client = new Client({
          domain: hostname,
          port,
          scheme: protocol?.replace(/:$/, ""),
          secret: connectionOptions.secret.buildSecret({ role }),
          timeout: this.flags.timeout,

          // Force http1. Fixes tests I guess? I spent a solid 30 minutes
          // debugging the whole `nock` thing in our tests, only to realize this
          // `fetch` key wasn't set after switching to the new config parsing.
          //
          // TODO: Remove and just connect to a docker container.
          fetch: fetch,

          headers: this._getHeaders(),
        });

        // validate the client settings
        await client.query(q.Now());

        const hashKey = [dbScope, role].join("_");
        this.clients[hashKey] = { client, connectionOptions };
        logConnectionMessage(connectionOptions);
        return this.clients[hashKey];
      } catch (err) {
        this.mapConnectionError({ err, connectionOptions });
      }
    } else {
      // construct v10 client
      let connectionOptions;
      try {
        connectionOptions = this.shellConfig.lookupEndpoint({ scope: dbScope });
        const client = new FaunaClient({
          endpoint: connectionOptions.url,
          secret: connectionOptions.secret.buildSecret({ role }),
          timeout: this.flags.timeout
            ? parseInt(this.flags.timeout, 10)
            : undefined,
        });

        // validate the client settings
        await client.query("0");

        const hashKey = [dbScope, role].join("_");
        this.clients[hashKey] = {
          client,
          connectionOptions,
        };
        logConnectionMessage(connectionOptions);
        return this.clients[hashKey];
      } catch (err) {
        this.mapConnectionError({ err, connectionOptions });
      }
    }
  }

  async ensureDbScopeClient({ scope, version }) {
    const path = scope.split("/");

    const { connectionOptions } = await this.getClient({ version: "4" });
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

        headers: this._getHeaders(),
      });
      const exists = await client.query(q.Exists(q.Database(path[i])));
      await client.close();

      if (!exists) {
        const fullPath = [
          ...connectionOptions.secret.databaseScope,
          ...path.slice(0, i + 1),
        ];
        this.error(`Database '${fullPath.join("/")}' doesn't exist`);
      }

      connectionOptions.secret.appendScope(path[i]);
    }

    return this.getClient({
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
    // Emits a warning if this flag is used.
    deprecated: { to: "url" },
    // Hides the flag in `--help`
    hidden: true,
  }),
  scheme: Flags.string({
    description: "Connection scheme",
    options: ["https", "http"],
    deprecated: { to: "url" },
    hidden: true,
  }),
  port: Flags.string({
    description: "Connection port",
    deprecated: { to: "url" },
    hidden: true,
  }),
  url: Flags.string({
    description: "Database URL. Overrides the `url` in ~/.fauna-shell",
  }),
  timeout: Flags.string({
    description: "Connection timeout in milliseconds",
  }),
  secret: Flags.string({
    description: "Secret key. Overrides the `secret` in ~/.fauna-shell",
  }),
  endpoint: Flags.string({
    description: "Connection endpoint, from ~/.fauna-shell",
  }),
  environment: Flags.string({
    description: "Environment to use, from a Fauna project",
  }),
  color: Flags.boolean({
    description: "Force color output",
    allowNo: true,
  }),
};

export default FaunaCommand;

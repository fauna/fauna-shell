const { Command, flags } = require('@oclif/command')
const {
  buildConnectionOptions,
  errorOut,
  stringifyEndpoint,
} = require('../lib/misc.js')
const faunadb = require('faunadb')
const q = faunadb.query

/**
 * This is the base class for all fauna-shell commands.
 */
class FaunaCommand extends Command {
  clients = {}

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
   *	...FaunaCommand.flags
   * }
   *
   */
  async init() {
    const { flags: f, args: a } = this.parse(this.constructor)
    this.flags = f
    this.args = a
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
    let connectionOptions
    try {
      connectionOptions = await buildConnectionOptions(
        this.flags,
        dbScope,
        role
      )

      const { graphqlHost, graphqlPort, ...clientOptions } = connectionOptions

      const client = new faunadb.Client({
        ...clientOptions,
        headers: {
          'X-Fauna-Source': 'Fauna Shell',
        },
      })
      await client.query(q.Now())
      //TODO this should return a Promise
      return f(client, connectionOptions)
    } catch (err) {
      return this.mapConnectionError({ err, connectionOptions })
    }
  }

  mapConnectionError({ err, connectionOptions }) {
    if (err instanceof faunadb.errors.Unauthorized) {
      return errorOut(
        `Could not Connect to ${stringifyEndpoint(
          connectionOptions
        )} Unauthorized Secret`,
        1
      )
    }
    return errorOut(err, 1)
  }

  async getClient({ dbScope, role } = {}) {
    let connectionOptions
    try {
      connectionOptions = await buildConnectionOptions(
        this.flags,
        dbScope,
        role
      )
      const { graphqlHost, graphqlPort, ...clientOptions } = connectionOptions
      const client = new faunadb.Client({
        ...clientOptions,
        headers: {
          'X-Fauna-Source': 'Fauna Shell',
        },
      })

      await client.query(q.Now()).then((r) => console.error('!!!!', r))

      const hashKey = [dbScope, role].join('_')
      this.clients[hashKey] = { client, connectionOptions }
      return this.clients[hashKey]
    } catch (err) {
      return this.mapConnectionError({ err, connectionOptions })
    }
  }

  async ensureDbScopeClient(dbname) {
    const { client } = await this.getClient()
    const exists = await client.query(q.Exists(q.Database(dbname)))
    if (!exists) {
      errorOut(`Database '${dbname}' doesn't exist`, 1)
    }

    return this.getClient({
      dbScope: dbname,
      role: 'admin',
    })
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
    const log = this.log
    return this.withClient(function (client, _) {
      log(logMsg)
      return client.query(queryExpr).then(success).catch(failure)
    })
  }

  dbExists(dbName, callback) {
    return this.withClient(function (testDbClient, _) {
      return testDbClient.query(q.Exists(q.Database(dbName))).then(callback)
    })
  }
}

/**
 * These flags allow the user to override endpoint configuration.
 * They are inherited by all shell commands that extend FaunaCommand.
 * See each command's flags to see how this mechanism works.
 */
FaunaCommand.flags = {
  ...Command.flags,
  domain: flags.string({
    description: 'FaunaDB server domain',
  }),
  scheme: flags.string({
    description: 'Connection scheme',
    options: ['https', 'http'],
  }),
  port: flags.string({
    description: 'Connection port',
  }),
  timeout: flags.string({
    description: 'Connection timeout in milliseconds',
  }),
  secret: flags.string({
    description: 'FaunaDB secret key',
  }),
  endpoint: flags.string({
    description: 'FaunaDB server endpoint',
  }),
  graphqlHost: flags.string({
    description: 'The Fauna GraphQL API host',
  }),
  graphqlPort: flags.string({
    description: 'GraphQL port',
  }),
}

module.exports = FaunaCommand

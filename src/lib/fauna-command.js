const { Command, flags } = require('@oclif/command')
const {
  buildConnectionOptions,
  errorOut,
  stringifyEndpoint,
  commafy,
} = require('../lib/misc.js')
const faunadb = require('faunadb')
const chalk = require('chalk')
const q = faunadb.query

// The response headers that contain query metrics
const metricsHeaders = {
  'bytesIn':    'x-query-bytes-in',
  'bytesOut':   'x-query-bytes-out',
  'queryTime':  'x-query-time',
  'readOps':    'x-read-ops',
  'writeOps':   'x-write-ops',
  'computeOps': 'x-compute-ops',
  'readBytes':  'x-storage-bytes-read',
  'writeBytes': 'x-storage-bytes-write',
  'retries':    'x-txn-retries',
}

// Query metrics counters
const metrics = {
  'bytesIn':    0,
  'bytesOut':   0,
  'queryTime':  0,
  'readOps':    0,
  'writeOps':   0,
  'computeOps': 0,
  'readBytes':  0,
  'writeBytes': 0,
  'retries':    0,
}

// Track the widths of metrics for justification
var metricsKeyWidth   = 0
var metricsValueWidth = 0

// left justify a value into a specified width
const lj = (value, width) => {
  return value + (' '.repeat(width - value.toString().length))
}

// right justify a value into a specified width
const rj = (value, width) => {
  return ' '.repeat(width - value.toString().length) + value
}

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

  success(msg) {
    const bang = chalk.green(process.platform === 'win32' ? '»' : '›')
    console.info(` ${bang}   Success: ${msg}`)
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

      if (this.flags.metrics) {
        client._observer = async (res) => { this.collectMetrics(res) }
      }

      //TODO this should return a Promise
      return f(client, connectionOptions)
    } catch (err) {
      return this.mapConnectionError({ err, connectionOptions })
    }
  }

  // Gather metrics from the response
  collectMetrics(res) {
    if (!res || !res.responseHeaders) return
    const h = res.responseHeaders

    const stats = {}
    Object.keys(metrics).forEach((key) => {
      stats[key] = parseInt(h[metricsHeaders[key]], 10)
    })

    var needTotals = false
    Object.keys(stats).forEach((key) => {
      var width = key.length
      if (width > metricsKeyWidth) metricsKeyWidth = width

      metrics[key] += stats[key]
      width = commafy(metrics[key]).toString().length
      if (width > metricsValueWidth) metricsValueWidth = width
      if (metrics[key] !== stats[key]) needTotals = true
    })
  }

  // Emit a metrics report
  showMetrics(label) {
    var output = `${label}: `

    const len = output.length
    output = `${chalk.cyan(label)}: `
    const items = Object.keys(metrics).length - 1
    Object.keys(metrics).forEach((key, index) => {
     const indent = (index === 0) ? output : ' '.repeat(len)
      const comma = index === items ? '' : ','
      const name = lj(key + comma, metricsKeyWidth + 1)
      const value = rj(commafy(metrics[key] ?? 0), metricsValueWidth)
      const sep = (index < items && (index + 1) % 3 === 0)
        ? `\n${indent}`
        : ' '
      output += `${value} ${chalk.grey(name)}${sep}`
    })
    console.log(output)
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

      await client.query(q.Now())

      if (this.flags.metrics) {
        console.log('Metrics needed!')
        client._observer = async (res) => { this.collectMetrics(res) }
      }

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

const {Command, flags} = require('@oclif/command')
const {buildConnectionOptions, errorOut} = require('../lib/misc.js')
const faunadb = require('faunadb')
const graphql = require('graphql-request')
const rp = require('request-promise')
const fs = require('fs')
const util = require('util')
const q = faunadb.query

const CLOUD_GQL_ENDPOINT = 'https://graphql.fauna.com'

/**
* This is the base class for all fauna-shell graphql commands.
*/
class GraphQLCommand extends Command {
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
    const {flags: f, args: a} = this.parse(this.constructor)
    this.flags = f
    this.args = a
    this.client = null
  }

  gqlErrorsToText(err) {
    let msg = ''
    err.response.errors.forEach(item => {
      msg = `${msg}\n${item.message}`
    })
    return msg
  }

  /**
  * Imports a a GraphQL schema definition file by uploading it to the API.
  *
  * @param {string}   config - Connection options.
  * @param {string}   path   - Path to GraphQL schema definition file
  */
  async importSchema(config, path) {
    const endpoint = config.gql_endpoint === null ? CLOUD_GQL_ENDPOINT : config.gql_endpoint
    const GQL_SCHEMA_IMPORT_URL = `${endpoint}/import`
    const readFile = util.promisify(fs.readFile)
    const buildGQLAuthToken = this.buildGQLAuthToken.bind(this)

    const gqlAuthToken = buildGQLAuthToken(config.gql_db_key)

    async function readSchema() {
      return readFile(path, 'utf8')
    }
    return readSchema().then(data => {
      let options = {
        method: 'POST',
        uri: GQL_SCHEMA_IMPORT_URL,
        body: data,
        resolveWithFullResponse: true,
        headers: {'Authorization': `Basic ${gqlAuthToken}`, 'Accept': 'application/json'},
      }
      return new Promise(function (resolve, reject) {
        rp(options).then(res => {
          resolve(res.body)
        }).catch(err => {
          reject(new Error(err))
        })
      })
    })
  }

  /**
  * Retrieves the graphql schema from the API.
  *
  * @param {}   config - Connection options.
  */
  retrieveSchema(config) {

  }

  /**
  * Executes a query on the gql api using the passed client.
  *
  * @param {GraphQLClient}   client - GraphQL client.
  * @param {String}          query  - GraphQL query to execute
  */
  async runQuery(client, query) {
    return new Promise(function (resolve, reject) {
      client.request(query).then(data => {
        resolve(data)
      }).catch(err => {
        reject(err)
      })
    })
  }

  shell() {

  }

  /**
  * Builds the authentication token used by the GQL API.
  *
  * @param {string}   key - Secret to access database.
  */
  buildGQLAuthToken(key) {
    const data = `${key}:`
    return Buffer.from(data).toString('base64')
  }

  /**
  * Runs the function in the context of a database connection.
  *
  * @param {function} f       - The function to run
  * @param {string}   dbScope - The database in which the function will be executed.
  * @param {string}   role    - The user role with which the function will be executed.
  */
  withClient(f, dbScope, role) {
    const cmdFlags = this.flags
    const buildGQLAuthToken = this.buildGQLAuthToken.bind(this)

    return buildConnectionOptions(cmdFlags, dbScope, role).then(connectionOptions => {
      const gqlEndpoint = connectionOptions.gql_endpoint === null ? CLOUD_GQL_ENDPOINT : connectionOptions.gql_endpoint
      const gqlAuthToken = buildGQLAuthToken(connectionOptions.gql_db_key)
      const endpoint = `${gqlEndpoint}/graphql`

      const options = {
        headers: {
          'Authorization': `Basic ${gqlAuthToken}`,
        },
      }
      let client = new graphql.GraphQLClient(endpoint, options)
      return f(client, connectionOptions)
    }).catch(function (err) {
      return errorOut(err, 1)
    })
  }
}

/**
* These flags allow the user to override endpoint configuration.
* They are inherited by all shell commands that extend GraphQLCommand.
* See each command's flags to see how this mechanism works.
*/
GraphQLCommand.flags = {

}

module.exports = GraphQLCommand

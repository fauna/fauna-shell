const util = require('util')
const esprima = require('esprima')
const {flags} = require('@oclif/command')
const FaunaCommand = require('../lib/fauna-command.js')
const {readFile, runQueries, errorOut, loadEndpoints} = require('../lib/misc.js')
const faunadb = require('faunadb')
const q = faunadb.query

function infoMessage(err) {
  const fe = util.inspect(err.faunaError, {depth: null})
  return `
  The following query failed:
    ${err.exp}

  With error message:
    ${fe}

  Query number:
    ${err.queryNumber}
  `
}

class RunQueriesCommand extends FaunaCommand {
  async run() {
    const dbscope = this.args.dbname
    const queriesFile = this.flags.file
    const role = 'admin'
    const withClient = this.withClient.bind(this)

    // first we test if the database specified by the user exists.
    // if that's the case, we create a connection scoped to that database.
    return this.withClient(function (testDbClient, _) {
      return testDbClient.query(q.Exists(q.Database(dbscope)))
      .then(function (exists) {
        if (exists) {
          return withClient(function (client, _) {
            return readFile(queriesFile)
            .then(function (data) {
              var res = esprima.parseScript(data)
              return runQueries(res.body, client)
              .then(function (response) {
                console.log(util.inspect(response, {depth: null}))
              })
              .catch(function (err) {
                errorOut(infoMessage(err), 1)
              })
            })
            .catch(function (err) {
              errorOut(err)
            })
          }, dbscope, role)
        } else {
          console.log("no exists")
          errorOut(`Database '${dbscope}' doesn't exist`, 1)
        }
      })
      .catch(function (err) {
        if (err.name == 'Unauthorized') {
          return loadEndpoints()
          .then(function (endpoints) {
            return errorOut(`You are not authorized to access the endpoint ${endpoints.default}.`, 1)
          })
        } else {
          return errorOut(err.message, 1)
        }
      })
    })
  }
}

RunQueriesCommand.description = `
Runs the queries found on the file passed to the command.
`

RunQueriesCommand.examples = [
  '$ fauna run-queries dbname --file=/path/to/queries.fql',
]

RunQueriesCommand.flags = {
  ...FaunaCommand.flags,
  file: flags.string({
    description: 'File where to read queries from',
  }),
}

RunQueriesCommand.args = [
  {
    name: 'dbname',
    required: true,
    description: 'database name',
  },
]

module.exports = RunQueriesCommand

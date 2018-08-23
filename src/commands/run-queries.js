const esprima = require('esprima')
const {flags} = require('@oclif/command')
const FaunaCommand = require('../lib/fauna_command.js')
const {readFile, runQueries, errorOut} = require('../lib/misc.js')
const faunadb = require('faunadb')
const q = faunadb.query

class RunQueriesCommand extends FaunaCommand {
  async run() {
    const dbscope = this.args.dbname
    const queriesFile = this.flags.file
    const role = 'admin'
    const withClient = this.withClient.bind(this)

    // first we test if the database specified by the user exists.
    // if that's the case, we create a connection scoped to that database.
    this.withClient(function (testDbClient, _) {
      testDbClient.query(q.Exists(q.Database(dbscope)))
      .then(function (exists) {
        if (exists) {
          withClient(function (client, _) {
            readFile(queriesFile)
            .then(function (data) {
              var res = esprima.parseScript(data)
              runQueries(res.body, client)
              .then(console.log.bind(console))
              .catch(console.error.bind(console))
            })
            .catch(function (err) {
              console.log(err)
            })
          }, dbscope, role)
        } else {
          errorOut(`Database '${dbscope}' doesn't exist`, 1)
        }
      })
      .catch(function (err) {
        errorOut(err, 1)
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

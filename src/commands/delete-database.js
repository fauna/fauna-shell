const FaunaCommand = require('../lib/fauna-command.js')
const {errorOut} = require('../lib/misc.js')
const faunadb = require('faunadb')
const q = faunadb.query

class DeleteDatabaseCommand extends FaunaCommand {
  async run() {
    const log = this.log
    const dbname = this.args.dbname
    return this.query(
      q.Delete(q.Database(dbname)),
      `deleting database '${dbname}'`,
      function (_) {
        log(`database '${dbname}' deleted`)
      },
      function (error) {
        if (error.message === 'invalid ref') {
          errorOut(`Database '${dbname}' not found`, 1)
        } else {
          errorOut(`Error: ${error.message}`, 1)
        }
      }
    )
  }
}

DeleteDatabaseCommand.description = `
Deletes a database
`

DeleteDatabaseCommand.examples = [
  '$ fauna delete-database dbname',
]

DeleteDatabaseCommand.flags = {
  ...FaunaCommand.flags,
}

DeleteDatabaseCommand.args = [
  {
    name: 'dbname',
    required: true,
    description: 'database name',
  },
]

module.exports = DeleteDatabaseCommand

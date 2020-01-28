const FaunaCommand = require('../lib/fauna-command.js')
const {errorOut} = require('../lib/misc.js')
const faunadb = require('faunadb')
const q = faunadb.query

function successMessage(database) {
  return `
  created database ${database}

  To start a shell with your new database, run:

  fauna shell ${database}

  Or, to create an application key for your database, run:

  fauna create-key ${database}
  `
}

class CreateDatabaseCommand extends FaunaCommand {
  async run() {
    const log = this.log
    const dbname = this.args.dbname
    return this.query(
      q.CreateDatabase({name: dbname}),
      `creating database ${dbname}`,
      function (_) {
        log(successMessage(dbname))
      },
      function (error) {
        if (error.message === 'instance not unique') {
          errorOut(`Database '${dbname}' already exists.`, 1)
        } else {
          errorOut(`Error: ${error.message}`, 1)
        }
      }
    )
  }
}

CreateDatabaseCommand.description = `
Creates a database
`

CreateDatabaseCommand.examples = [
  '$ fauna create-database dbname',
]

CreateDatabaseCommand.flags = {
  ...FaunaCommand.flags,
}

CreateDatabaseCommand.args = [
  {
    name: 'dbname',
    required: true,
    description: 'database name',
  },
]

module.exports = CreateDatabaseCommand

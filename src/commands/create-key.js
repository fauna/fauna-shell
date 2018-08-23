const FaunaCommand = require('../lib/fauna_command.js')
const {errorOut} = require('../lib/misc.js')
const faunadb = require('faunadb')
const q = faunadb.query

function successMessage(database, role, secret) {
  return `
  created key for database '${database}' with role '${role}'.
  secret: ${secret}

  To access '${database}' with this key, create a client using
  the driver library for your language of choice using
  the above secret.
  `
}

class CreateKeyCommand extends FaunaCommand {
  async run() {
    const log = this.log
    const dbname = this.args.dbname
    const role = this.args.role || 'admin'
    this.query(
      q.CreateKey({database: q.Database(dbname), role: role}),
      `creating key for database '${dbname}' with role '${role}'`,
      function (success) {
        log(successMessage(success.database.id, success.role, success.secret))
      },
      //TODO when the DB doesn't exist we get 'validation failed' back, display a better message.
      function (error) {
        errorOut(error.message, 1)
      }
    )
  }
}

CreateKeyCommand.description = `
Creates a key for the specified database
`

CreateKeyCommand.examples = [
  '$ fauna create-key dbname admin',
]

CreateKeyCommand.flags = {
  ...FaunaCommand.flags,
}

CreateKeyCommand.args = [
  {
    name: 'dbname',
    required: true,
    description: 'database name',
  },
  {
    name: 'role',
    description: 'key user role',
    options: ['admin', 'server', 'server-readonly', 'client'],
  },
]

module.exports = CreateKeyCommand

const FaunaCommand = require('../lib/fauna-command.js')
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
    const that = this
    return this.dbExists(dbname, function (exists) {
      if (exists) {
        return that.query(
          q.CreateKey({database: q.Database(dbname), role: role}),
          `creating key for database '${dbname}' with role '${role}'`,
          function (success) {
            log(successMessage(success.database.id, success.role, success.secret))
          },
          function (error) {
            errorOut(error.message, 1)
          }
        )
      } else {
        errorOut(`Database '${dbname}' doesn't exist`, 1)
      }
    })
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

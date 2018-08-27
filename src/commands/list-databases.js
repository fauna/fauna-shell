const FaunaCommand = require('../lib/fauna-command.js')
const {errorOut} = require('../lib/misc.js')
const faunadb = require('faunadb')
const q = faunadb.query

/**
* Despite its name, returns the first 1000 databases defined.
* "1000 databases ought to be enough for anybody".
*/
function allDatabasesQuery(q) {
  return q.Map(q.Paginate(q.Databases(null), {size: 1000}), q.Lambda('x', q.Get(q.Var('x'))))
}

class ListDatabasesCommand extends FaunaCommand {
  async run() {
    const log = this.log
    return this.withClient(function (client, _) {
      log('listing databases')
      return client.query(allDatabasesQuery(q))
      .then(function (res) {
        if (res.data.length > 0) {
          res.data.forEach(function (el) {
            log(el.ref.id)
          })
        } else {
          log('No databases created')
        }
      })
      .catch(function (err) {
        errorOut(err.message)
      })
    })
  }
}

ListDatabasesCommand.description = `
Lists top level databases
`

ListDatabasesCommand.examples = [
  '$ fauna list-databases',
]

ListDatabasesCommand.flags = {
  ...FaunaCommand.flags,
}

module.exports = ListDatabasesCommand

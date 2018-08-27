const FaunaCommand = require('../lib/fauna-command.js')
const {errorOut} = require('../lib/misc.js')
const faunadb = require('faunadb')
const q = faunadb.query
const Table = require('cli-table')

/**
* See the cli-table docs: https://github.com/Automattic/cli-table
*/
function getTable() {
  return new Table({
    chars: {'top': '', 'top-mid': '', 'top-left': '', 'top-right': '',
      'bottom': '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
      'left': '', 'left-mid': '', 'mid': '', 'mid-mid': '',
      'right': '', 'right-mid': '', 'middle': ' '},
    head: ['Key ID', 'Database', 'Role'],
    colWidths: [20, 20, 20],
    style: {'padding-left': 0, 'padding-right': 0},
  })
}

/**
* Sorts keys by database name.
*
* @param {Key} a - Key reference.
* @param {Key} b - Key reference.
*/
function compareByDBName(a, b) {
  if (a.database.id < b.database.id) {
    return -1
  } else if (a.database.id > b.database.id) {
    return 1
  }
  return 0
}

function buildTable(res) {
  const table = getTable()
  res.data.sort(compareByDBName)
  res.data.forEach(function (el) {
    table.push([el.ref.id, el.database.id, el.role])
  })
  return table
}

/**
* Despite its name, returns the first 1000 keys defined on the Database.
* "1000 keys ought to be enough for anybody".
*/
function allKeysQuery(q) {
  return q.Map(q.Paginate(q.Keys(null), {size: 1000}), q.Lambda('x', q.Get(q.Var('x'))))
}

class ListKeysCommand extends FaunaCommand {
  async run() {
    const log = this.log
    return this.withClient(function (client, _) {
      log('listing keys')
      return client.query(allKeysQuery(q))
      .then(function (res) {
        if (res.data.length > 0) {
          log(buildTable(res).toString())
        } else {
          log('No keys created')
        }
      })
      .catch(function (err) {
        errorOut(err.message)
      })
    })
  }
}

ListKeysCommand.description = `
Lists top level keys
`

ListKeysCommand.examples = [
  '$ fauna list-keys',
]

ListKeysCommand.flags = {
  ...FaunaCommand.flags,
}

module.exports = ListKeysCommand

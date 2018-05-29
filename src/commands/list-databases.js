const FaunaCommand = require('../lib/fauna_command.js')
const faunadb = require('faunadb');
const q = faunadb.query;

class ListDatabasesCommand extends FaunaCommand {
  async run() {
		this.paginate(
			q.Databases(null),
			'listing databases'
		);
  }
}

ListDatabasesCommand.description = `
Lists top level databases
`

ListDatabasesCommand.examples = [
	'$ fauna-shell list-databases'
]

ListDatabasesCommand.flags = {
	...FaunaCommand.flags
}

module.exports = ListDatabasesCommand

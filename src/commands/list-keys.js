const FaunaCommand = require('../lib/fauna_command.js')
const faunadb = require('faunadb');
const q = faunadb.query;

class ListKeysCommand extends FaunaCommand {
	async run() {
		this.paginate(
			q.Keys(null),
			'listing keys'
		);
	}
}

ListKeysCommand.description = `
Lists top level keys
`

ListKeysCommand.examples = [
	'$ fauna-shell list-keys'
]

ListKeysCommand.flags = {
	...FaunaCommand.flags
}

module.exports = ListKeysCommand

const {flags} = require('@oclif/command')
const FaunaCommand = require('../lib/fauna_command.js')
const faunadb = require('faunadb');
const q = faunadb.query;

class ListDatabasesCommand extends FaunaCommand {
  async run() {
		const log = this.log;
		
		this.withClient(function(client) {
			log(`listing databases`);
		  var helper = client.paginate(q.Databases(null));
		  helper.each(function(page) {
			  log(page);
		  });
		});
  }
}

ListDatabasesCommand.description = `
Lists top level databases
`

ListDatabasesCommand.examples = [
	'$ fauna-shell list-databases'
]

module.exports = ListDatabasesCommand

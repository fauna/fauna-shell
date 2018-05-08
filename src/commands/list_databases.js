const {Command, flags} = require('@oclif/command')
const FaunaCommand = require('../lib/fauna_command.js')
const faunadb = require('faunadb');
const q = faunadb.query;

class ListDatabasesCommand extends FaunaCommand {
  async run() {
	  const {flags} = this.parse(ListDatabasesCommand);
	  const name = flags.name || 'default';
		const log = this.log;
		
		this.withClient(function(client) {
		  var helper = client.paginate(q.Databases(null));
		  helper.each(function(page) {
			  log(page);
		  });
		})
  }
}

ListDatabasesCommand.description = `
Describe the command here
...
Extra documentation goes here
`

module.exports = ListDatabasesCommand

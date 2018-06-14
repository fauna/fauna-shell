const FaunaCommand = require('../lib/fauna_command.js')
const faunadb = require('faunadb');
const q = faunadb.query;
const Table = require('cli-table');

function getTable() {
	return new Table({
	  chars: { 'top': '' , 'top-mid': '' , 'top-left': '' , 'top-right': ''
	         , 'bottom': '' , 'bottom-mid': '' , 'bottom-left': '' , 'bottom-right': ''
	         , 'left': '' , 'left-mid': '' , 'mid': '' , 'mid-mid': ''
	         , 'right': '' , 'right-mid': '' , 'middle': ' ' },
	    head: ['Key ID', 'Database', 'Role'],
	 		colWidths: [20, 20, 20],
			style: { 'padding-left': 0, 'padding-right': 0 }
	});
}

function compareByDBName(a, b) {
	if (a.database.id < b.database.id) {
		return -1;
	} else if (a.database.id > b.database.id) {
		return 1;
	}
	return 0;
}

class ListKeysCommand extends FaunaCommand {
	async run() {
		const log = this.log;
		this.withClient(function(client) {
		  log('listing keys');
		  client.query(q.Map(q.Paginate(q.Keys(null), { size: 1000 }), q.Lambda("x", q.Get(q.Var("x")))))
		  .then(function(res) {
				if (res.data.length > 0) {
					const table = getTable()
					res.data.sort(compareByDBName)
					res.data.forEach(function(el) {
						table.push([el.ref.id, el.database.id, el.role])
					})
					log(table.toString()) 
				} else {
					log('No keys created')
				}
		  })
		  .catch(function(error) {
			  log("Error:", error.message);
		  });
		});
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

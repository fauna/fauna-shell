const {loadEndpoints, errorOut} = require('../lib/misc.js')
const FaunaCommand = require('../lib/fauna_command.js')
const ini = require('ini')

class ListEndpointsCommand extends FaunaCommand {
	async run() {
		const log = this.log
		loadEndpoints()
		.then(function(endpoints) {
			var keys = Object.keys(endpoints);
			if (keys.length == 0) {
				throw(`No endpoints defined.\nSee fauna add-endpoint --help for more details.`)
			} else {
				keys.forEach(function(endpoint) {
					// skip the key that stores the default endpoint
					if (endpoint == 'default') {
						return; //in JS return skips this iteration.
					}
					var enabled = "";
					if (endpoint == endpoints['default']) {
						enabled = "*"
					}
					log(`${endpoint} ${enabled}`)
				})
			}
		})
		.catch(function(err) {
			errorOut(err, 1)
		});
	}
}

ListEndpointsCommand.description = `
Lists FaunaDB connection endpoints
`

ListEndpointsCommand.examples = [
	'$ fauna list-endpoints'
]

// clear the default FaunaCommand flags that accept --host, --port, etc.
ListEndpointsCommand.flags = {
}

module.exports = ListEndpointsCommand
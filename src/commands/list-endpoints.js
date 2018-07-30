const {fileNotFound, readFile, getConfigFile, errorOut} = require('../lib/misc.js')
const FaunaCommand = require('../lib/fauna_command.js')
const ini = require('ini')

class ListEndpointsCommand extends FaunaCommand {
	async run() {
		const log = this.log
		readFile(getConfigFile())
		.then(function(configData) {
			const config = configData ? ini.parse(configData) : {}
			var keys = Object.keys(config);
			keys.forEach(function(endpoint) {
				if (endpoint == 'default') {
					return; //in JS return skips this iteration.
				}
				var enabled = "";
				if (endpoint == config['default']) {
					enabled = "*"
				}
				log(`${endpoint} ${enabled}`)
			})
		})
		.catch(function(err) {
			if (fileNotFound(err)) {
				errorOut(`No endpoint's defined.\nSee fauna add-endpoint --help for more details.`, 1)
			} else {
				errorOut(err, 1)
			}
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
FaunaCommand.flags = {
}

module.exports = ListEndpointsCommand
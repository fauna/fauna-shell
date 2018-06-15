const {readFile, getConfigFile, errorOut} = require('../lib/misc.js')
const FaunaCommand = require('../lib/fauna_command.js')
const ini = require('ini')

class ListEndpointCommand extends FaunaCommand {
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
			if (err.code == 'ENOENT' && err.syscall == 'open' && err.errno == -2) {
				errorOut("No endpoints defined.", 1)
			} else {
				errorOut(err, 1)
			}
		});
	}
}

ListEndpointCommand.description = `
Lists FaunaDB connection endpoints
`

ListEndpointCommand.examples = [
	'$ fauna-shell list-endpoints'
]

FaunaCommand.flags = {
}

module.exports = ListEndpointCommand
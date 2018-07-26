const {flags} = require('@oclif/command')
const {fileNotFound, readFile, getConfigFile, errorOut} = require('../lib/misc.js')
const FaunaCommand = require('../lib/fauna_command.js')
const ini = require('ini')
const fs = require('fs')

class DefaultEndpointCommand extends FaunaCommand {
	async run() {
		const log = this.log
		const endpoint = this.args.endpoint_alias
		
		const setDefaultEndpoint = function(configData, endpoint) {
			const config = configData ? ini.parse(configData) : {}
			if (config[endpoint]) {
				config['default'] = endpoint
				fs.writeFileSync(getConfigFile(), ini.stringify(config), {mode: 0o700})
				log(`Endpoint ${endpoint} set as default endpoint.`);
			} else {
				errorOut(`Endpoint ${endpoint} doesn't exist.`, 1);
			}
		}

		readFile(getConfigFile())
		.then(function(configData) {
			setDefaultEndpoint(configData, endpoint)
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

DefaultEndpointCommand.description = `
Sets an endpoint as the default one
`

DefaultEndpointCommand.examples = [
	'$ fauna default-endpoint endpoint'
]

// clear the default FaunaCommand flags that accept --host, --port, etc.
FaunaCommand.flags = {
}

DefaultEndpointCommand.args = [
	{
		name: 'endpoint_alias', 
		required: true, 
		description: 'FaunaDB server endpoint'
	},
]

module.exports = DefaultEndpointCommand
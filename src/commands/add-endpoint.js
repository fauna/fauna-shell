const {cli} = require('cli-ux')
const {fileNotFound, saveEndpointOrError, readFile, getConfigFile, errorOut} = require('../lib/misc.js')
const FaunaCommand = require('../lib/fauna_command.js')
const url = require('url')

class AddEndpointCommand extends FaunaCommand {
	async run() {
		const endpoint = this.args.endpoint;
		
		const parsedEndpoint = url.parse(endpoint);
		if (!parsedEndpoint.hostname) {
			throw "You must provide a valid endpoint.";
		}

		const secret = await cli.prompt('Endpoint Key', {type: 'hide', timeout: 120000})	
		const alias = await cli.prompt('Endpoint Alias', {default: parsedEndpoint.hostname, timeout: 120000})
		
		if (alias == 'default' || alias == 'cloud') {
			errorOut(`The word '${alias}' cannot be usded as an alias.`, 1)
		}
		
		readFile(getConfigFile())
		.then(function(configData) {
			saveEndpointOrError(configData, endpoint, secret, alias)
		})
		.catch(function(err) {
			if (fileNotFound(err)) {
				saveEndpointOrError("", endpoint, secret, alias)
			} else {
				errorOut(err, 1)
			}
		});
	}
}

AddEndpointCommand.description = `
Adds a connection endpoint for FaunaDB
`

AddEndpointCommand.examples = [
	'$ fauna add-endpoint https://db.fauna.com:443'
]

// clear the default FaunaCommand flags that accept --host, --port, etc.
AddEndpointCommand.flags = {
}

AddEndpointCommand.args = [
	{
		name: 'endpoint', 
		required: true, 
		description: 'FaunaDB server endpoint'
	},
]

module.exports = AddEndpointCommand
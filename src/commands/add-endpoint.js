const {cli} = require('cli-ux')
const {fileNotFound, handleConfigOrError, readFile, getConfigFile, errorOut} = require('../lib/misc.js')
const FaunaCommand = require('../lib/fauna_command.js')
const url = require('url')

class AddEndpointCommand extends FaunaCommand {
	async run() {
		const endpoint = this.args.endpoint;
		
		const parsedEndpoint = url.parse(endpoint);
		if (!parsedEndpoint.hostname) {
			throw "You must provide a valid endpoint.";
		}

		const secret = await cli.prompt('Endpoint Key', {type: 'hide', timeout: 1})	
		const alias = await cli.prompt('Endpoint Alias', {default: parsedEndpoint.hostname, timeout: 1})
		
		if (alias == 'default' || alias == 'cloud') {
			errorOut(`The word '${alias}' cannot be usded as an alias.`, 1)
		}
		
		readFile(getConfigFile())
		.then(function(configData) {
			handleConfigOrError(configData, endpoint, secret, alias)
		})
		.catch(function(err) {
			if (fileNotFound(err)) {
				handleConfigOrError("", endpoint, secret, alias)
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

FaunaCommand.flags = {
}

AddEndpointCommand.args = [
	{
		name: 'endpoint', 
		required: true, 
		description: 'FaunaDB server endpoint'
	},
]

module.exports = AddEndpointCommand
const {cli} = require('cli-ux')
const {readFile, getConfigFile, errorOut} = require('../lib/misc.js')
const FaunaCommand = require('../lib/fauna_command.js')
const ini = require('ini')
const url = require('url')
const fs = require('fs')

class AddEndpointCommand extends FaunaCommand {
	async run() {
		//TODO improve error handling or validate URL
		const endpoint = url.parse(this.args.endpoint)
		if (!endpoint.hostname) {
			errorOut("you must provide a valid endpoint", 1)
		}
		
		const secret = await cli.prompt('Endpoint Key', {type: 'hide'})	
		const alias = await cli.prompt('Endpoint Alias', {default: endpoint.hostname})
		
		if (alias == 'default') {
			errorOut("The word 'default' cannot be usded as an alias.", 1)
		}
		
		const handleConfig = function(configData, endpoint, secret) {
			const config = configData ? ini.parse(configData) : {}
			
			// if we don't have any endopints, then the new one will be enabled
			var enabled = Object.keys(config).length == 0 ? true : false
			// if the endpoint already exists, we might need to keep it enabled if it was
			if (config['default'] == alias) {
				enabled = true;
			}
			
			var domain = endpoint.hostname;
			var port = endpoint.port;
			var scheme = endpoint.protocol.slice(0, -1) //the scheme is parsed as 'http:'
		  domain = domain === null ? null : {domain}
			port = port === null ? null : {port}
			scheme = scheme === null ? null : {scheme}
			config[alias] = {}
			if (enabled) {
				config['default'] = alias;
			}
			
			Object.assign(config[alias], domain, port, scheme, {secret})
			fs.writeFileSync(getConfigFile(), ini.stringify(config))
		}
		
		readFile(getConfigFile())
		.then(function(configData) {
			handleConfig(configData, endpoint, secret)
		})
		.catch(function(err) {
			if (err.code == 'ENOENT' && err.syscall == 'open' && err.errno == -2) {
				handleConfig("", endpoint, secret)
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
	'$ fauna-shell add-endpoint https://db.fauna.com:443'
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
const {flags} = require('@oclif/command')
const {readFile, getConfigFile} = require('../lib/misc.js')
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
				var keys = Object.keys(config);
				keys.forEach(function(key) {
					config[key].enabled = false
				})
				config[endpoint].enabled = true
				fs.writeFileSync(getConfigFile(), ini.stringify(config))
				log(`Endpoint ${endpoint} set as default endpoint.`);
			} else {
				log(`Endpoint ${endpoint} doesn't exist.`);
			}
		}

		readFile(getConfigFile())
		.then(function(configData) {
			setDefaultEndpoint(configData, endpoint)
		})
		.catch(function(err) {
			if (err.code == 'ENOENT' && err.syscall == 'open' && err.errno == -2) {
				console.log(`There's no endpoint defined.\nSee fauna add-endpoint --help for more details.`)
			} else {
				console.log(err)
			}
		});
	}
}

DefaultEndpointCommand.description = `
Sets an endpoint as the default one
`

DefaultEndpointCommand.examples = [
	'$ fauna-shell default-endpoint endpoint'
]

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
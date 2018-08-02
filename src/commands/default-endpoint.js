const {flags} = require('@oclif/command')
const {setDefaultEndpoint, errorOut} = require('../lib/misc.js')
const FaunaCommand = require('../lib/fauna_command.js')
const ini = require('ini')
const fs = require('fs')

class DefaultEndpointCommand extends FaunaCommand {
	async run() {
		const log = this.log
		setDefaultEndpoint(this.args.endpoint_alias)
		.then(this.log)
		.catch(errorOut)
	}
}

DefaultEndpointCommand.description = `
Sets an endpoint as the default one
`

DefaultEndpointCommand.examples = [
	'$ fauna default-endpoint endpoint'
]

// clear the default FaunaCommand flags that accept --host, --port, etc.
DefaultEndpointCommand.flags = {
}

DefaultEndpointCommand.args = [
	{
		name: 'endpoint_alias', 
		required: true, 
		description: 'FaunaDB server endpoint'
	},
]

module.exports = DefaultEndpointCommand
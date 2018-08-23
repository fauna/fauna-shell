const {deleteEndpointOrError} = require('../lib/misc.js')
const FaunaCommand = require('../lib/fauna_command.js')

class DeleteEndpoint extends FaunaCommand {
  async run() {
    deleteEndpointOrError(this.args.endpoint_alias)
  }
}

DeleteEndpoint.description = `
Deletes a connection endpoint for FaunaDB
`

DeleteEndpoint.examples = [
  '$ fauna delete-endpoint endpoint_alias',
]

// clear the default FaunaCommand flags that accept --host, --port, etc.
DeleteEndpoint.flags = {
}

DeleteEndpoint.args = [
  {
    name: 'endpoint_alias',
    required: true,
    description: 'FaunaDB server endpoint alias',
  },
]

module.exports = DeleteEndpoint

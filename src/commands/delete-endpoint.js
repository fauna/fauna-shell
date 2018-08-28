const {deleteEndpointOrError, errorOut} = require('../lib/misc.js')
const FaunaCommand = require('../lib/fauna-command.js')

class DeleteEndpoint extends FaunaCommand {
  async run() {
    const alias = this.args.endpoint_alias
    return deleteEndpointOrError(alias)
    .catch(function (err) {
      errorOut(err.message, 1)
    })
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

const {setDefaultEndpoint, errorOut} = require('../lib/misc.js')
const FaunaCommand = require('../lib/fauna-command.js')

class DefaultEndpointCommand extends FaunaCommand {
  async run() {
    return setDefaultEndpoint(this.args.endpoint_alias)
    .then(this.log)
    .catch(function (err) {
      errorOut(err.message, 1)
    })
  }
}

DefaultEndpointCommand.description = `
Sets an endpoint as the default one
`

DefaultEndpointCommand.examples = [
  '$ fauna default-endpoint endpoint',
]

// clear the default FaunaCommand flags that accept --host, --port, etc.
DefaultEndpointCommand.flags = {
}

DefaultEndpointCommand.args = [
  {
    name: 'endpoint_alias',
    required: true,
    description: 'FaunaDB server endpoint alias',
  },
]

module.exports = DefaultEndpointCommand

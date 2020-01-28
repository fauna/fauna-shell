const {cli} = require('cli-ux')
const { flags } = require('@oclif/command')
const {saveEndpointOrError, errorOut} = require('../lib/misc.js')
const FaunaCommand = require('../lib/fauna-command.js')
const url = require('url')

class AddEndpointCommand extends FaunaCommand {
  async run() {
    const endpoint = this.args.endpoint
    let secret = this.flags.key
    let alias = this.flags.alias
    const log = this.log

    const newEndpoint = url.parse(endpoint)
    if (!newEndpoint.hostname) {
      throw new Error('You must provide a valid endpoint.')
    }

    if (!secret)
      secret = await cli.prompt('Endpoint Key', {type: 'hide', timeout: 120000})
    if (!alias)
      alias = await cli.prompt('Endpoint Alias', { default: newEndpoint.hostname, timeout: 120000 })

    if (!this.flags.alias && (alias === 'default' || alias === 'cloud')) {
      throw new Error(`The word '${alias}' cannot be used as an alias.`)
    }
    return saveEndpointOrError(newEndpoint, alias, secret).then(function () {
      log(`Endpoint '${alias}' saved.`)
    }).catch(function (err) {
      errorOut(err.message, 1)
    })
  }
}

AddEndpointCommand.description = `
Adds a connection endpoint for FaunaDB
`

AddEndpointCommand.examples = [
  '$ fauna add-endpoint https://db.fauna.com:443',
  '$ fauna add-endpoint http://localhost:8443/ --alias localhost --key secret',
]

// clear the default FaunaCommand flags that accept --host, --port, etc.
AddEndpointCommand.flags = {
  alias: flags.string({
    description: 'FaunaDB server endpoint alias',
    required: false,
  }),
  key: flags.string({
    description: 'FaunaDB server endpoint key',
    required: false,
  }),
}

AddEndpointCommand.args = [
  {
    name: 'endpoint',
    required: true,
    description: 'FaunaDB server endpoint',
  },
]

module.exports = AddEndpointCommand

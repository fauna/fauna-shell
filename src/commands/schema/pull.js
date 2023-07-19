const FaunaCommand = require('../../lib/fauna-command.js')
const fetch = require('node-fetch')
const { errorOut } = require('../../lib/misc.js')

class PullSchemaCommand extends FaunaCommand {
  async run() {
    const log = this.log
    const filename = this.args.filename
    const {
      connectionOptions: { domain, port, scheme, secret },
    } = await this.getClient()

    return fetch(`${scheme}://${domain}:${port}/schema/1/files/${filename}`, {
      method: 'GET',
      headers: { AUTHORIZATION: `Bearer ${secret}` },
    })
      .then(async function (res) {
        const json = await res.json()
        log(json.content)
      })
      .catch(function (err) {
        errorOut(err)
      })
  }
}

PullSchemaCommand.description =
  'Pull a database schema file and display its contents'

PullSchemaCommand.examples = ['$ fauna schema:pull main.fsl']

PullSchemaCommand.args = [
  {
    name: 'filename',
    required: true,
    description: 'name of schema file',
  },
]

PullSchemaCommand.flags = {
  ...FaunaCommand.flags,
}
module.exports = PullSchemaCommand

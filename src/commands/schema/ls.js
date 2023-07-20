const FaunaCommand = require('../../lib/fauna-command.js')
const fetch = require('node-fetch')
const { errorOut } = require('../../lib/misc.js')

class ListSchemaCommand extends FaunaCommand {
  async run() {
    const log = this.log
    const {
      connectionOptions: { domain, port, scheme, secret },
    } = await this.getClient()

    return fetch(`${scheme}://${domain}:${port}/schema/1/files`, {
      method: 'GET',
      headers: { AUTHORIZATION: `Bearer ${secret}` },
    })
      .then(async function (res) {
        const json = await res.json()
        if (json.files.length > 0) {
          log('Schema files:\n')
          json.files.forEach(function (file) {
            log(file.filename)
          })
        } else {
          log('No schema files')
        }
      })
      .catch(function (err) {
        errorOut(err)
      })
  }
}

ListSchemaCommand.description = 'List database schema files'

ListSchemaCommand.examples = ['$ fauna schema:ls']

ListSchemaCommand.args = []

ListSchemaCommand.flags = {
  ...FaunaCommand.flags,
}
module.exports = ListSchemaCommand

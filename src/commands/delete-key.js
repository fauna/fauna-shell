const FaunaCommand = require('../lib/fauna-command.js')
const {errorOut} = require('../lib/misc.js')
const faunadb = require('faunadb')
const q = faunadb.query

class DeleteKeyCommand extends FaunaCommand {
  async run() {
    const keyname = this.args.keyname
    const log = this.log
    return this.query(
      q.Delete(q.Ref(q.Keys(null), keyname)),
      `deleting key ${keyname}`,
      function (success) {
        log(`key ${success.ref.id} deleted`)
      },
      function (error) {
        if (error.message === 'instance not found') {
          errorOut(`Key ${keyname} not found`, 1)
        } else {
          errorOut(error.message, 1)
        }
      }
    )
  }
}

DeleteKeyCommand.description = `
Deletes a key
`

DeleteKeyCommand.examples = [
  '$ fauna delete-key 123456789012345678',
]

DeleteKeyCommand.flags = {
  ...FaunaCommand.flags,
}

DeleteKeyCommand.args = [
  {
    name: 'keyname',
    required: true,
    description: 'key name',
  },
]

module.exports = DeleteKeyCommand

const {cli} = require('cli-ux')
const {flags} = require('@oclif/command')
const {validGraphQLEndpoint, saveEndpointOrError, errorOut} = require('../lib/misc.js')
const GraphQLCommand = require('../lib/graphql-command.js')
const util = require('util')
const fs = require('fs')

class GQLCommand extends GraphQLCommand {
  async runQueryFromFile(client, path) {
    const readFile = util.promisify(fs.readFile)
    const runQuery = this.runQuery.bind(this)

    async function readQuery() {
      return readFile(path, 'utf8')
    }

    return readQuery().then(data => {
      return runQuery(client, data)
    })
  }

  async run() {
    const withClient = this.withClient.bind(this)
    const importSchema = this.importSchema.bind(this)
    const runQueryFromFile = this.runQueryFromFile.bind(this)
    const log = this.log.bind(this)
    const gqlErrorsToText = this.gqlErrorsToText.bind(this)

    const addSchema = this.flags.import
    const schema = this.flags.schema
    const querySrc = this.flags.query
    const dbname = this.args.dbname

    return validGraphQLEndpoint(dbname)
    .then(async function (_) {
      withClient((client, config) => {
        if (addSchema) {
          importSchema(config, addSchema).then(data => {
            log('Schema imported successfully.')
            log('Run with --schema flag to retrieve database schema.')
          }).catch(err => {
            log('Error whilst importing schema definition')
            errorOut(JSON.stringify(err))
          })
        } else if (schema) {
          log('Not yet implemented')
        } else if (querySrc) {
          runQueryFromFile(client, querySrc).then(data => {
            console.dir(data, {depth: null, colors: true})
          }).catch(err => {
            log('Failed to execute query')
            log(gqlErrorsToText(err))
          })
        } else {
          errorOut('At least one command must be passed. Run `fauna graphql --help` for usage.')
        }
      }, dbname, null)
    })
  }
}

GQLCommand.description = `
Interact with Fauna GraphQL API
`

GQLCommand.examples = [
  '$ fauna graphql cloud --import=/tmp/schema.GQL',
  '$ fauna graphql cloud --schema',
  '$ fauna graphql cloud --query=/path/to/file',
]

// clear the default FaunaCommand flags that accept --host, --port, etc.
GQLCommand.flags = {
  import: flags.string({
    description: 'Import your schema definition',
  }),
  query: flags.string({
    description: 'Run a GQL query from a file',
  }),
  schema: flags.string({
    description: 'Retrieve the schema, including FaunaDB generated metadata',
  }),
}

GQLCommand.args = [
  {
    name: 'dbname',
    required: false,
    description: 'database name',
  },
]

module.exports = GQLCommand

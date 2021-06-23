const FaunaCommand = require('../lib/fauna-command.js')
const { flags } = require('@oclif/command')
const fetch = require('node-fetch')
const fs = require('fs')
const path = require('path')
const { errorOut } = require('../lib/misc.js')

class UploadGraphQLSchemaCommand extends FaunaCommand {
  allowedExt = ['.graphql', '.gql']

  async run() {
    try {
      const { graphqlFilePath } = this.args
      const { mode } = this.flags

      if (!this.allowedExt.includes(path.extname(graphqlFilePath))) {
        errorOut(
          'Your GraphQL schema file must include the `.graphql` or `.gql` extension.'
        )
      }

      const {
        connectionOptions: { secret, graphqlHost, graphqlPort, scheme },
      } = await this.getClient()

      console.info(`UPLOADING SCHEMA (mode=${mode}): ${graphqlFilePath}`)
      const text = await fetch(
        `${scheme}://${graphqlHost}:${graphqlPort}/import?mode=${mode}`,
        {
          method: 'POST',
          headers: { AUTHORIZATION: `Bearer ${secret}` },
          body: fs.readFileSync(graphqlFilePath),
        }
      ).then((response) => response.text())

      console.info('RESPONSE:')
      console.info(text)
    } catch (error) {
      errorOut(error)
    }
  }
}

UploadGraphQLSchemaCommand.description = 'Upload GraphQL schema'

UploadGraphQLSchemaCommand.examples = [
  '$ fauna upload-graphql-schema ./schema.gql',
  '$ fauna upload-graphql-schema ./schema.gql --mode override',
]

UploadGraphQLSchemaCommand.args = [
  {
    name: 'graphqlFilePath',
    required: true,
    description: 'Path to GraphQL schema',
  },
]

UploadGraphQLSchemaCommand.flags = {
  ...FaunaCommand.flags,
  mode: flags.string({
    description: 'Upload mode',
    default: 'merge',
    options: ['merge', 'override'],
  }),
}
module.exports = UploadGraphQLSchemaCommand

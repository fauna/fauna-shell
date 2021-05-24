const FaunaCommand = require('../lib/fauna-command.js')
const { flags, Command } = require('@oclif/command')
const fetch = require('node-fetch')
const fs = require('fs')
const path = require('path')
const { errorOut } = require('../lib/misc.js')

class UploadGraphQLSchemaCommand extends FaunaCommand {
  allowedExt = ['.graphql', '.gql']

  async run() {
    try {
      const { graphqlPath } = this.args
      const { mode, graphqlHost } = this.flags

      if (!this.allowedExt.includes(path.extname(graphqlPath))) {
        errorOut(
          'You must provide a Graphql file (`.graphql` or `.gql`) to upload a schema'
        )
      }

      const {
        connectionOptions: { secret },
      } = await this.getClient()

      console.info(`UPLOADING SCHEMA (mode=${mode}): ${graphqlPath}`)
      const text = await fetch(`${graphqlHost}/import?mode=${mode}`, {
        method: 'POST',
        headers: { AUTHORIZATION: `Bearer ${secret}` },
        body: fs.readFileSync(graphqlPath),
      }).then((response) => response.text())

      console.info('RESPONSE:')
      console.info(text)
    } catch (error) {
      errorOut(error)
    }
  }
}

UploadGraphQLSchemaCommand.description = 'Upload GraphQL Schema'

UploadGraphQLSchemaCommand.examples = [
  '$ fauna upload-graphql-schema ./schema.gql',
  '$ fauna upload-graphql-schema ./schema.gql --mode override',
]

UploadGraphQLSchemaCommand.args = [
  {
    name: 'graphqlPath',
    required: true,
    description: 'Path to GraphQL schema',
  },
]

UploadGraphQLSchemaCommand.flags = {
  ...Command.flags,
  graphqlHost: flags.string({
    default: 'https://graphql.fauna.com',
    description: 'The Fauna GraphQL API host',
  }),
  secret: flags.string({
    description: 'FaunaDB secret key',
  }),
  mode: flags.string({
    description: 'Upload mode',
    default: 'merge',
    options: ['merge', 'override'],
  }),
}
module.exports = UploadGraphQLSchemaCommand

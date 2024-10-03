import pushCommand from './push.mjs'
import pullCommand from './pull.mjs'
import statusCommand from './status.mjs'

function buildSchema(yargs) {
  return yargs
    .options({
      "project-directory": {
        alias: ['directory', 'dir'],
        type: 'string',
        description: "The path to the project directory containing the schema files to interact with.",
        default: "."
      }
    })
    .command(pushCommand)
    .command(pullCommand)
    .command(statusCommand)
    .demandCommand()
    .help('help', 'show help')
}

export default {
  command: 'schema',
  describe: 'Manipulate Fauna schema stat',
  builder: buildSchema
}

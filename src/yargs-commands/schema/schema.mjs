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
    .command("push", "Push the current project's .fsl files to Fauna.", pushCommand)
    .command("pull", "Pull a database schema's .fsl files into the current project.", pullCommand)
    .command("status", "Print the staged schema status.", statusCommand)
    .demandCommand()
    .help('help', 'show help')
}

export default {
  builder: buildSchema,
  handler: () => {}
}

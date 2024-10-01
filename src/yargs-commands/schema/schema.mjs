import pushCommand from './push.mjs'

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
    .demandCommand()
}

export default {
  builder: buildSchema,
  handler: () => {}
}

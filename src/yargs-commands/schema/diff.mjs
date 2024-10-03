import { container } from '../../cli.mjs'
import { commonQueryOptions } from '../../lib/command-helpers.mjs'

async function doDiff() {
  const gatherRelativeFSLFilePaths = container.resolve("gatherRelativeFSLFilePaths")
  const read = container.resolve("read")
  const logger = container.resolve("logger")

  const fps = gatherRelativeFSLFilePaths()
  const files = read(fps)

  const params = new URLSearchParams({ force: "true" })
  if (argv.color) params.set("color", "ansi")

  const response = await makeFaunaRequest({
    baseUrl: argv.url,
    path: (new URL(`/schema/1/validate?${params}`, argv.url)).href,
    secret: argv.secret,
    // TODO: does body work?
    body: this.body(files),
    method: "POST",
  })

  logger.stdout(response.diff ? response.diff : "No schema differences");
}

function buildDiffCommand(yargs) {
  return yargs
  .options({
    ...commonQueryOptions,
  })
  .example([
    ["$0 schema diff"],
    ["$0 schema diff --dir schemas/myschema"],
  ])
  .version(false)
  .help('help', 'show help')
}

export default {
  command: "diff",
  description: "Print the diff between local and remote schema.",
  builder: buildDiffCommand,
  handler: doDiff
}

import { container } from '../../cli.mjs'
import { commonQueryOptions } from '../../lib/command-helpers.mjs';

async function doStatus(argv) {
  const logger = (await container.resolve("logger"))
  const fetch = container.resolve("fetch")

  const params = new URLSearchParams()
  if (argv.color)
    params.set("diff", "true")

  const res = await fetch(
    (new URL(`/schema/1/staged/status?${params}`, argv.url)).toString(),
    {
      method: "GET",
      headers: { AUTHORIZATION: `Bearer ${argv.secret}` },
      // https://github.com/nodejs/node/issues/46221
      // https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/1483
      duplex: "half",
    }
  );

  const json = await res.json();
  if (json.error) {
    logger.stderr(json.error.message);
  }

  logger.stdout(json.diff);
}

function buildStatusCommand(yargs) {
  return yargs
  .options({
    ...commonQueryOptions,
  })
  .example([
    ["$0 schema status"],
  ])
  .version(false)
  .help('help', 'show help')
}

export default {
  command: 'status',
  describe: 'Print the staged schema status',
  builder: buildStatusCommand,
  handler: doStatus
}

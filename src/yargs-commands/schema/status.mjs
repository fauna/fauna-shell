//@ts-check

import { container } from "../../cli.mjs";
import { commonQueryOptions } from "../../lib/command-helpers.mjs";

async function doStatus(argv) {
  const logger = container.resolve("logger");
  const makeFaunaRequest = container.resolve("makeFaunaRequest");

  const params = new URLSearchParams({ diff: "true" });
  if (argv.color) params.set("color", "ansii");

  const response = await makeFaunaRequest({
    baseUrl: argv.url,
    path: `/schema/1/staged/status?${params}`,
    secret: argv.secret,
    method: "GET",
  });

  logger.stdout(response.diff);
}

function buildStatusCommand(yargs) {
  return yargs
    .options({
      ...commonQueryOptions,
    })
    .example([["$0 schema status"]])
    .version(false)
    .help("help", "show help");
}

export default {
  command: "status",
  description: "Print the staged schema status.",
  builder: buildStatusCommand,
  handler: doStatus,
};

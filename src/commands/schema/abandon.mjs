//@ts-check

import { container } from "../../cli.mjs";
import { commonQueryOptions } from "../../lib/command-helpers.mjs";

async function doAbandon(argv) {
  const makeFaunaRequest = container.resolve("makeFaunaRequest");
  const logger = container.resolve("logger");
  const confirm = container.resolve("confirm");

  if (!argv.input) {
    const params = new URLSearchParams({
      force: "true", // Just abandon, don't pass a schema version through.
    });

    await makeFaunaRequest({
      argv,
      path: "/schema/1/staged/abandon",
      params,
      method: "POST",
    });
    logger.stdout("Schema has been abandoned");
  } else {
    // Show status to confirm.
    const params = new URLSearchParams({ diff: "true" });

    const response = await makeFaunaRequest({
      argv,
      path: "/schema/1/staged/status",
      params,
      method: "GET",
    });

    if (response.status === "none")
      throw new Error("There is no staged schema to abandon");

    logger.stdout(response.diff);

    const confirmed = await confirm({
      message: "Abandon these changes?",
      default: false,
    });

    if (confirmed) {
      const params = new URLSearchParams({ version: response.version });

      await makeFaunaRequest({
        argv,
        path: "/schema/1/staged/abandon",
        params,
        method: "POST",
      });

      logger.stdout("Schema has been abandoned");
    } else {
      logger.stdout("Abandon cancelled");
    }
  }
}

function buildAbandonCommand(yargs) {
  return yargs
    .options({
      input: {
        description: "Prompt for user input (e.g., confirmations)",
        default: true,
        type: "boolean",
      },
      ...commonQueryOptions,
    })
    .example([["$0 schema abandon"]])
    .version(false)
    .help("help", "show help");
}

export default {
  command: "abandon",
  description: "Abandons the currently staged schema.",
  builder: buildAbandonCommand,
  handler: doAbandon,
};

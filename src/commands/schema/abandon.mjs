//@ts-check

import { container } from "../../cli.mjs";
import { yargsWithCommonQueryOptions } from "../../lib/command-helpers.mjs";
import { getSecret } from "../../lib/fauna-client.mjs";

async function doAbandon(argv) {
  const makeFaunaRequest = container.resolve("makeFaunaRequest");
  const logger = container.resolve("logger");
  const confirm = container.resolve("confirm");
  const secret = await getSecret();

  if (!argv.input) {
    const params = new URLSearchParams({
      force: "true", // Just abandon, don't pass a schema version through.
    });

    await makeFaunaRequest({
      argv,
      path: "/schema/1/staged/abandon",
      params,
      method: "POST",
      secret,
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
      secret,
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
        secret,
      });

      logger.stdout("Schema has been abandoned");
    } else {
      logger.stdout("Abandon cancelled");
    }
  }
}

function buildAbandonCommand(yargs) {
  return yargsWithCommonQueryOptions(yargs)
    .options({
      input: {
        description: "Prompt for user input (e.g., confirmations)",
        default: true,
        type: "boolean",
      },
    })
    .example([["$0 schema abandon"]])
    .help("help", "Show help.");
}

export default {
  command: "abandon",
  description: "Abandon the current staged schema.",
  builder: buildAbandonCommand,
  handler: doAbandon,
};

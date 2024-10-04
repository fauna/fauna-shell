import { confirm } from "@inquirer/prompts";

import { commonQueryOptions } from "../../lib/command-helpers.mjs";
import { container } from "../../cli.mjs";

async function doAbandon(argv) {
  const makeFaunaRequest = container.resolve("makeFaunaRequest");
  const logger = container.resolve("logger");
  const exit = container.resolve("exit");

  if (argv.force) {
    const params = new URLSearchParams({
      force: "true", // Just abandon, don't pass a schema version through.
    });

    await makeFaunaRequest({
      baseUrl: argv.url,
      path: new URL(`/schema/1/staged/abandon?${params}`, argv.url).href,
      secret: argv.secret,
      method: "POST",
    });
    logger.stdout("Schema has been abandonded");
  } else {
    // Show status to confirm.
    const params = new URLSearchParams({ diff: "true" });
    if (argv.color) params.set("color", "ansi");

    const response = await makeFaunaRequest({
      baseUrl: argv.url,
      path: new URL(`/schema/1/staged/status?${params}`, argv.url).href,
      secret: argv.secret,
      method: "GET",
    });

    if (response.status === "none") {
      logger.stderr("There is no staged schema to abandon");
      exit(1);
    }

    logger.stdout(response.diff);

    const confirmed = await confirm({
      message: "Abandon these changes?",
      default: false,
    });

    if (confirmed) {
      const params = new URLSearchParams({ version: response.version });

      await makeFaunaRequest({
        baseUrl: argv.url,
        path: new URL(`/schema/1/staged/abandon?${params}`, argv.url).href,
        secret: argv.secret,
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
      ...commonQueryOptions,
      force: {
        description: "Push the change without a diff or schema version check",
        type: "boolean",
        default: false,
      },
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

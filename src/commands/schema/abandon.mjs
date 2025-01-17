//@ts-check

import { container } from "../../config/container.mjs";
import { CommandError } from "../../lib/errors.mjs";
import { getSecret } from "../../lib/fauna-client.mjs";

async function doAbandon(argv) {
  const makeFaunaRequest = container.resolve("makeFaunaRequest");
  const logger = container.resolve("logger");
  const confirm = container.resolve("confirm");
  const secret = await getSecret(argv);

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
    logger.stdout("Schema has been abandoned.");
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
      throw new CommandError("There is no staged schema to abandon.");

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

      logger.stdout("Schema has been abandoned.");
    } else {
      logger.stdout("Abandon cancelled.");
    }
  }
}

function buildAbandonCommand(yargs) {
  return yargs
    .options({
      input: {
        description: "Prompt for input. Use --no-input to disable.",
        default: true,
        type: "boolean",
      },
    })
    .example([
      [
        "$0 schema abandon --database us/my_db",
        "Abandon staged schema for the 'us/my_db' database.",
      ],
      [
        "$0 schema abandon --secret my-secret",
        "Abandon staged schema for the database scoped to a secret.",
      ],
      [
        "$0 schema abandon --database us/my_db --no-input",
        "Run the command without input prompts.",
      ],
    ]);
}

export default {
  command: "abandon",
  description: "Abandon a database's staged schema.",
  builder: buildAbandonCommand,
  handler: doAbandon,
};

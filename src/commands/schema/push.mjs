//@ts-check

import { container } from "../../cli.mjs";
import { yargsWithCommonQueryOptions } from "../../lib/command-helpers.mjs";
import { getSecret } from "../../lib/fauna-client.mjs";
import { reformatFSL } from "../../lib/schema.mjs";
import { localSchemaOptions } from "./schema.mjs";

async function doPush(argv) {
  const logger = container.resolve("logger");
  const makeFaunaRequest = container.resolve("makeFaunaRequest");
  const gatherFSL = container.resolve("gatherFSL");

  const isStagedPush = !argv.active;
  const secret = await getSecret();

  const fsl = reformatFSL(await gatherFSL(argv.dir));

  if (!argv.input) {
    const params = new URLSearchParams({
      force: "true",
      staged: argv.active ? "false" : "true",
    });

    await makeFaunaRequest({
      argv,
      path: "/schema/1/update",
      params,
      body: fsl,
      method: "POST",
      secret,
    });
  } else {
    // Confirm diff, then push it.
    const params = new URLSearchParams({
      staged: argv.active ? "false" : "true",
    });

    const response = await makeFaunaRequest({
      argv,
      path: "/schema/1/diff",
      params,
      body: fsl,
      method: "POST",
      secret,
    });

    let message = isStagedPush
      ? "Stage the above changes?"
      : "Push the above changes?";
    if (response.diff) {
      logger.stdout(`Proposed diff:\n`);
      logger.stdout(response.diff);
    } else {
      logger.stdout("No logical changes.");
      message = isStagedPush
        ? "Stage the file contents anyway?"
        : "Push the file contents anyway?";
    }
    const confirm = container.resolve("confirm");
    const confirmed = await confirm({
      message,
      default: false,
    });

    if (confirmed) {
      const params = new URLSearchParams({
        version: response.version,
        staged: argv.active ? "false" : "true",
      });

      await makeFaunaRequest({
        argv,
        path: "/schema/1/update",
        params,
        body: fsl,
        method: "POST",
        secret,
      });
    } else {
      logger.stdout("Push cancelled.");
    }
  }
}

function buildPushCommand(yargs) {
  return yargsWithCommonQueryOptions(yargs)
    .options({
      input: {
        description:
          "Prompt for input, such as confirmation. To disable prompts, use `--no-input` or `--input=false`. Disabled prompts are useful for scripts, CI/CD, and automation workflows.",
        default: true,
        type: "boolean",
      },
      active: {
        description:
          "Immediately apply the local schema to the database's active schema. Skips staging the schema. Can result in temporarily unavailable indexes.",
        type: "boolean",
        default: false,
      },
      ...localSchemaOptions,
    })
    .example([
      [
        "$0 schema push --database us/example --dir /path/to/schema",
        "Stage schema changes for the 'us/example' database. If schema is already staged, replace the staged schema.",
      ],
      [
        "$0 schema push --secret my-secret --dir /path/to/schema",
        "Stage schema changes for the database scoped to a secret. If schema is already staged, replace the staged schema.",
      ],
      [
        "$0 schema push --database us/example --dir /path/to/schema --active",
        "Immediately apply changes to the 'us/example' database's active schema.",
      ],
      [
        "$0 schema push --database us/example --dir /path/to/schema --no-input",
        "Run the command without input prompts.",
      ],
    ]);
}

export default {
  command: "push",
  description: "Push local .fsl schema files to Fauna.",
  builder: buildPushCommand,
  handler: doPush,
};

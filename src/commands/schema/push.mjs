//@ts-check

import { container } from "../../cli.mjs";
import { yargsWithCommonQueryOptions } from "../../lib/command-helpers.mjs";
import { reformatFSL } from "../../lib/schema.mjs";

async function doPush(argv) {
  const logger = container.resolve("logger");
  const makeFaunaRequest = container.resolve("makeFaunaRequest");

  const gatherFSL = container.resolve("gatherFSL");
  const fsl = reformatFSL(await gatherFSL(argv.dir));

  const isStagedPush = !argv.active;

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
    });
  } else {
    // Confirm diff, then push it. `force` is set on `validate` so we don't
    // need to pass the last known schema version through.
    const params = new URLSearchParams({
      force: "true",
      staged: argv.active ? "false" : "true",
    });

    const response = await makeFaunaRequest({
      argv,
      path: "/schema/1/validate",
      params,
      body: fsl,
      method: "POST",
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
      });
    } else {
      logger.stdout("Push cancelled");
    }
  }
}

function buildPushCommand(yargs) {
  return yargsWithCommonQueryOptions(yargs)
    .options({
      input: {
        description: "Prompt for user input (e.g., confirmations)",
        default: true,
        type: "boolean",
      },
      active: {
        description:
          "Immediately applies the schema change instead of staging it",
        type: "boolean",
        default: false,
      },
    })
    .example([
      ["$0 schema push"],
      ["$0 schema push --dir schemas/myschema"],
      ["$0 schema push --active"],
    ])
    .version(false)
    .help("help", "show help");
}

export default {
  command: "push",
  description: "Push the current project's .fsl files to Fauna.",
  builder: buildPushCommand,
  handler: doPush,
};

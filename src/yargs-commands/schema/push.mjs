//@ts-check

import { container } from "../../cli.mjs";
import { confirm } from "@inquirer/prompts";
import { commonQueryOptions } from "../../lib/command-helpers.mjs";

async function doPush(argv) {
  const logger = container.resolve("logger");
  const makeFaunaRequest = container.resolve("makeFaunaRequest");

  const gatherFSL = container.resolve("gatherFSL");
  const fsl = await gatherFSL(argv.dir);
  if (argv.force) {
    const params = new URLSearchParams({
      force: argv.force,
      staged: argv.staged,
    });

    await makeFaunaRequest({
      baseUrl: argv.url,
      path: `/schema/1/update?${params}`,
      body: fsl,
      secret: argv.secret,
      method: "POST",
    });
  } else {
    // Confirm diff, then push it. `force` is set on `validate` so we don't
    // need to pass the last known schema version through.
    const params = new URLSearchParams({ force: "true" });
    if (argv.color) params.set("color", "ansi");

    const response = await makeFaunaRequest({
      baseUrl: argv.url,
      path: `/schema/1/validate?${params}`,
      body: fsl,
      secret: argv.secret,
      method: "POST",
    });

    let message = "Accept and push changes?";
    if (response.diff) {
      logger.stdout(`Proposed diff:\n`);
      logger.stdout(response.diff);
    } else {
      logger.stdout("No logical changes.");
      message = "Push file contents anyway?";
    }
    const confirmed = await confirm({
      message,
      default: false,
    });

    if (confirmed) {
      const params = new URLSearchParams({
        version: response.version,
        staged: argv.staged ? "true" : "false",
      });

      await makeFaunaRequest({
        baseUrl: argv.url,
        path: `/schema/1/update?${params}`,
        body: fsl,
        secret: argv.secret,
        method: "POST",
      });
    } else {
      logger.stdout("Push cancelled");
    }
  }
}

function buildPushCommand(yargs) {
  return yargs
    .options({
      ...commonQueryOptions,
      force: {
        description: "Push the change without a diff or schema version check",
        type: "boolean",
        default: false,
      },
      staged: {
        description:
          "Stages the schema change instead of applying it immediately",
        type: "boolean",
        default: false,
      },
    })
    .example([
      ["$0 schema push"],
      ["$0 schema push --dir schemas/myschema"],
      ["$0 schema push --staged"],
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
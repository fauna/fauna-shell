//@ts-check

import { container } from "../../cli.mjs";
import { commonQueryOptions } from "../../lib/command-helpers.mjs";

async function doCommit(argv) {
  const makeFaunaRequest = container.resolve("makeFaunaRequest");
  const logger = container.resolve("logger");
  const confirm = container.resolve("confirm");

  if (argv.force) {
    const params = new URLSearchParams({
      force: "true", // Just commit, don't pass a schema version through.
    });

    await makeFaunaRequest({
      baseUrl: argv.url,
      path: `/schema/1/staged/commit?${params}`,
      secret: argv.secret,
      method: "POST",
    });

    logger.stdout("Schema has been committed");
  } else {
    // Show status to confirm.
    const params = new URLSearchParams({ diff: "true" });
    if (argv.color) params.set("color", "ansi");

    const response = await makeFaunaRequest({
      baseUrl: argv.url,
      path: `/schema/1/staged/status?${params}`,
      secret: argv.secret,
      method: "GET",
    });

    if (response.status === "none")
      throw new Error("There is no staged schema to commit");

    logger.stdout(response.diff);

    if (response.status !== "ready")
      throw new Error("Schema is not ready to be committed");

    const confirmed = await confirm({
      message: "Accept and commit these changes?",
      default: false,
    });

    if (confirmed) {
      const params = new URLSearchParams({ version: response.version });

      await makeFaunaRequest({
        baseUrl: argv.url,
        path: `/schema/1/staged/commit?${params}`,
        secret: argv.secret,
        method: "POST",
      });

      logger.stdout("Schema has been committed");
    } else {
      logger.stdout("Commit cancelled");
    }
  }
}

function buildCommitCommand(yargs) {
  return yargs
    .options({
      force: {
        description: "Push the change without a diff or schema version check",
        type: "boolean",
        default: false,
      },
      ...commonQueryOptions,
    })
    .example([["$0 schema commit"]])
    .version(false)
    .help("help", "show help");
}

export default {
  command: "commit",
  description: "Push the current project's .fsl files to Fauna.",
  builder: buildCommitCommand,
  handler: doCommit,
};

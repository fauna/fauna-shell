//@ts-check

import { container } from "../../cli.mjs";
import { yargsWithCommonQueryOptions } from "../../lib/command-helpers.mjs";
import { CommandError } from "../../lib/errors.mjs";

async function doCommit(argv) {
  const confirm = container.resolve("confirm");
  const { getSecret } = container.resolve("faunaClient");
  const logger = container.resolve("logger");
  const makeFaunaRequest = container.resolve("makeFaunaRequest");

  const secret = await getSecret();

  if (!argv.input) {
    const params = new URLSearchParams({
      force: "true", // Just commit, don't pass a schema version through.
    });

    await makeFaunaRequest({
      argv,
      path: "/schema/1/staged/commit",
      params,
      method: "POST",
      secret,
    });

    logger.stdout("Schema has been committed");
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
      throw new CommandError("There is no staged schema to commit");

    logger.stdout(response.diff);

    if (response.status !== "ready")
      throw new CommandError("Schema is not ready to be committed");

    const confirmed = await confirm({
      message: "Accept and commit these changes?",
      default: false,
    });

    if (confirmed) {
      const params = new URLSearchParams({ version: response.version });

      await makeFaunaRequest({
        argv,
        path: "/schema/1/staged/commit",
        params,
        method: "POST",
        secret,
      });

      logger.stdout("Schema has been committed");
    } else {
      logger.stdout("Commit cancelled");
    }
  }
}

function buildCommitCommand(yargs) {
  return yargsWithCommonQueryOptions(yargs)
    .options({
      input: {
        description: "Prompt for input. Use --no-input to disable.",
        default: true,
        type: "boolean",
      },
    })
    .example([
      [
        "$0 schema commit --database us/my_db",
        "Commit staged schema for the 'us/my_db' database.",
      ],
      [
        "$0 schema commit --secret my-secret",
        "Commit staged schema for the database scoped to a secret.",
      ],
      [
        "$0 schema commit --database us/my_db --no-input",
        "Run the command without input prompts.",
      ],
    ]);
}

export default {
  command: "commit",
  description: "Apply a staged schema to a database.",
  builder: buildCommitCommand,
  handler: doCommit,
};

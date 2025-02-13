//@ts-check

import { container } from "../../config/container.mjs";
import { CommandError } from "../../lib/errors.mjs";
import { getSecret } from "../../lib/fauna-client.mjs";

async function doCommit(argv) {
  const makeFaunaRequest = container.resolve("makeFaunaRequest");
  const logger = container.resolve("logger");
  const confirm = container.resolve("confirm");
  const secret = await getSecret(argv);

  if (!argv.input) {
    await makeFaunaRequest({
      argv,
      path: "/schema/1/staged/commit",
      method: "POST",
      secret,
    });

    logger.stdout("Schema has been committed");
  } else {
    // Show status to confirm.
    const params = new URLSearchParams({ format: "semantic" });

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

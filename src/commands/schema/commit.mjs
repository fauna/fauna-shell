//@ts-check

import { container } from "../../cli.mjs";
import {
  CommandError,
  yargsWithCommonQueryOptions,
} from "../../lib/command-helpers.mjs";
import { getSecret } from "../../lib/fauna-client.mjs";

async function doCommit(argv) {
  const makeFaunaRequest = container.resolve("makeFaunaRequest");
  const logger = container.resolve("logger");
  const confirm = container.resolve("confirm");
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
        description:
          "Prompt for input, such as confirmation. To disable prompts, use `--no-input` or `--input=false`. Disabled prompts are useful for scripts, CI/CD, and automation workflows.",
        default: true,
        type: "boolean",
      },
    })
    .example([
      [
        "$0 schema commit --database us/example",
        "Commit staged schema for the 'us/example' database.",
      ],
      [
        "$0 schema commit --secret my-secret",
        "Commit staged schema for the database scoped to a secret.",
      ],
      [
        "$0 schema commit --database us/example --no-input",
        "Run the command without input prompts.",
      ],
    ])
    .help("help", "Show help.");
}

export default {
  command: "commit",
  description: "Apply staged schema files to a database.",
  builder: buildCommitCommand,
  handler: doCommit,
};

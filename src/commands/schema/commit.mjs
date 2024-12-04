//@ts-check

import { container } from "../../cli.mjs";
import { yargsWithCommonQueryOptions } from "../../lib/command-helpers.mjs";

async function doCommit(argv) {
  const makeFaunaRequest = container.resolve("makeFaunaRequest");
  const logger = container.resolve("logger");
  const confirm = container.resolve("confirm");

  if (!argv.input) {
    const params = new URLSearchParams({
      force: "true", // Just commit, don't pass a schema version through.
    });

    await makeFaunaRequest({
      argv,
      path: "/schema/1/staged/commit",
      params,
      method: "POST",
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
        argv,
        path: "/schema/1/staged/commit",
        params,
        method: "POST",
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
        description: "Prompt for input, such as confirmation. Use `--no-input` to run the command without prompts. Useful for scripts, CI/CD, and automation workflows.",
        default: true,
        type: "boolean",
      },
    })
    .example([["$0 schema commit"]])
    .version(false)
    .help("help", "Show help.");
}

export default {
  command: "commit",
  description: "Apply staged schema files to a database.",
  builder: buildCommitCommand,
  handler: doCommit,
};

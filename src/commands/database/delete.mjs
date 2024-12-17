//@ts-check

import { ServiceError } from "fauna";

import { container } from "../../cli.mjs";
import { validateDatabaseOrSecret } from "../../lib/command-helpers.mjs";
import { CommandError } from "../../lib/errors.mjs";
import { faunaToCommandError } from "../../lib/fauna.mjs";

async function runDeleteQuery(secret, argv) {
  const { fql } = container.resolve("fauna");
  const { runQuery } = container.resolve("faunaClientV10");
  return runQuery({
    secret,
    url: argv.url,
    query: fql`Database.byName(${argv.name}).delete()`,
  });
}

async function deleteDatabase(argv) {
  const { getSecret, retryInvalidCredsOnce } = container.resolve("faunaClient");

  const secret = await getSecret();
  const logger = container.resolve("logger");

  try {
    await retryInvalidCredsOnce(secret, async (secret) =>
      runDeleteQuery(secret, argv),
    );

    // We use stderr for messaging and there's no stdout output for a deleted database
    logger.stderr(`Database '${argv.name}' was successfully deleted.`);
  } catch (err) {
    faunaToCommandError({
      err,
      color: argv.color,
      handler: (err) => {
        if (err instanceof ServiceError && err.code === "document_not_found") {
          throw new CommandError(
            `Database '${argv.name}' not found. Please check the database name and try again.`,
          );
        }
      },
    });
  }
}

function buildDeleteCommand(yargs) {
  return yargs
    .options({
      name: {
        type: "string",
        required: true,
        description: "Name of the database to delete.",
      },
    })
    .check(validateDatabaseOrSecret)
    .example([
      [
        "$0 database delete --name example --database us",
        "Delete the top-level 'example' database in the 'us' Region Group.",
      ],
      [
        "$0 database delete --name my_db --database us/example",
        "Delete the 'my_db' child database directly under 'us/example'.",
      ],
      [
        "$0 database delete --name my_db --secret my-secret",
        "Delete the 'my_db' child database directly under the database scoped to a secret.",
      ],
    ]);
}

export default {
  command: "delete",
  description: "Delete a database.",
  builder: buildDeleteCommand,
  handler: deleteDatabase,
};

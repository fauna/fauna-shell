//@ts-check

import { ServiceError } from "fauna";

import { container } from "../../config/container.mjs";
import { CommandError } from "../../lib/errors.mjs";
import { faunaToCommandError } from "../../lib/fauna.mjs";
import { getSecret, retryInvalidCredsOnce } from "../../lib/fauna-client.mjs";
import { validateDatabaseOrSecret } from "../../lib/middleware.mjs";

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
  const secret = await getSecret(argv);
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
        "$0 database delete --name my_db --database us",
        "Delete the top-level 'my_db' database in the 'us' Region Group.",
      ],
      [
        "$0 database delete --name child_db --database us/parent_db",
        "Delete the 'child_db' child database directly under 'us/parent_db'.",
      ],
      [
        "$0 database delete --name child_db --secret my-secret",
        "Delete the 'child_db' child database directly under the database scoped to a secret.",
      ],
    ]);
}

export default {
  command: "delete",
  description: "Delete a database.",
  builder: buildDeleteCommand,
  handler: deleteDatabase,
};

//@ts-check

import { FaunaError } from "fauna";

import { container } from "../../cli.mjs";
import { throwForError } from "../../lib/fauna.mjs";
import { getSecret, retryInvalidCredsOnce } from "../../lib/fauna-client.mjs";
import { validateSecretOrDatabase } from "./database.mjs";

function validate(argv) {
  validateSecretOrDatabase(argv);
  return true;
}

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
  const secret = await getSecret();
  const logger = container.resolve("logger");

  try {
    await retryInvalidCredsOnce(secret, async (secret) =>
      runDeleteQuery(secret, argv),
    );

    // We use stderr for messaging and there's no stdout output for a deleted database
    logger.stderr(`Database '${argv.name}' was successfully deleted.`);
  } catch (e) {
    if (e instanceof FaunaError) {
      throwForError(e, {
        onDocumentNotFound: () =>
          `Not found: Database '${argv.name}' not found. Please check the database name and try again.`,
      });
    }
    throw e;
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
    .check(validate)
    .help("help", "Show help.")
    .example([
      [
        "$0 database delete --name my_database --database us/example",
        "Delete a database named 'my_database' directly under 'us/example'.",
      ],
      [
        "$0 database delete --name my_database --secret my-secret",
        "Delete a database named 'my_database' directly under the database scoped to a secret.",
      ],
    ]);
}

export default {
  command: "delete",
  description: "Delete a child database.",
  builder: buildDeleteCommand,
  handler: deleteDatabase,
};

//@ts-check

import { FaunaError } from "fauna";

import { container } from "../../cli.mjs";
import { throwForError } from "../../lib/fauna.mjs";

async function deleteDatabase(argv) {
  const { fql } = container.resolve("fauna");
  const logger = container.resolve("logger");
  const { runQuery } = container.resolve("faunaClientV10");

  try {
    await runQuery({
      url: argv.url,
      secret: argv.secret,
      query: fql`Database.byName(${argv.name}).delete()`,
    });

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
        description: "the name of the database to delete",
      },
    })
    .version(false)
    .help("help", "show help");
}

export default {
  command: "delete",
  description: "Deletes a database",
  builder: buildDeleteCommand,
  handler: deleteDatabase,
};

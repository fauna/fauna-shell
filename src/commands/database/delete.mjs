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
    logger.stdout(`Database '${argv.name}' was successfully deleted.`);
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
    .version(false)
    .help("help", "Show help.");
}

export default {
  command: "delete",
  description: "Delete a child database.",
  builder: buildDeleteCommand,
  handler: deleteDatabase,
};

//@ts-check

import { FaunaError, fql } from "fauna";
import { container } from "../../cli.mjs";
import { throwForV10Error } from "../../lib/fauna.mjs";

async function deleteDatabase(argv) {
  const logger = container.resolve("logger");
  const runV10Query = container.resolve("runV10Query");

  try {
    await runV10Query({
      url: argv.url,
      secret: argv.secret,
      query: fql`Database.byName(${argv.name}).delete()`,
    });
    logger.stdout(`Database '${argv.name}' was successfully deleted.`);
  } catch (e) {
    if (e instanceof FaunaError) {
      throwForV10Error(e, {
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

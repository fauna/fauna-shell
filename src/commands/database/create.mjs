//@ts-check

import { FaunaError } from "fauna";

import { container } from "../../cli.mjs";
import { throwForError } from "../../lib/fauna.mjs";

async function createDatabase(argv) {
  const logger = container.resolve("logger");
  const { fql } = container.resolve("fauna");
  const { runQuery } = container.resolve("faunaClientV10");

  try {
    await runQuery({
      url: argv.url,
      secret: argv.secret,
      query: fql`Database.create({
        name: ${argv.name},
        protected: ${argv.protected ?? null},
        typechecked: ${argv.typechecked ?? null},
        priority: ${argv.priority ?? null},
      })`,
    });
    logger.stdout(`Database '${argv.name}' was successfully created.`);
  } catch (e) {
    if (e instanceof FaunaError) {
      throwForError(e, {
        onConstraintFailure: () =>
          `Constraint failure: The database '${argv.name}' may already exists or one of the provided options may be invalid.`,
      });
    }
    throw e;
  }
}

function buildCreateCommand(yargs) {
  return yargs
    .options({
      name: {
        type: "string",
        required: true,
        description: "Name of the database to create.",
      },
      typechecked: {
        type: "string",
        description: "Enable typechecking for the database. Defaults to the typechecking setting of the parent database.",
      },
      protected: {
        type: "boolean",
        description: "Enable protected mode for the database. Protected mode disallows destructive schema changes.",
      },
      priority: {
        type: "number",
        description: "User-defined priority for the database.",
      },
    })
    .version(false)
    .help("help", "Show help.");
}

export default {
  command: "create",
  description: "Create a child database.",
  builder: buildCreateCommand,
  handler: createDatabase,
};

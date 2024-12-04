//@ts-check

import { FaunaError } from "fauna";

import { container } from "../../cli.mjs";
import { throwForError } from "../../lib/fauna.mjs";
import { formatObjectForShell } from "../../lib/misc.mjs";

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

    logger.stderr(`Database successfully created.`);

    const { color, json } = argv;
    if (json) {
      logger.stdout(formatObjectForShell({ name: argv.name }, { color }));
    } else {
      logger.stdout(argv.name);
    }
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
        description: "the name of the database to create",
      },
      typechecked: {
        type: "string",
        description: "enable typechecking for the database",
      },
      protected: {
        type: "boolean",
        description: "allow destructive schema changes",
      },
      priority: {
        type: "number",
        description: "user-defined priority assigned to the child database",
      },
    })
    .version(false)
    .help("help", "show help");
}

export default {
  command: "create",
  description: "Creates a database",
  builder: buildCreateCommand,
  handler: createDatabase,
};

//@ts-check

import { container } from "../../cli.mjs";
import { fql, FaunaError } from "fauna";
import { throwForV10Error } from "../../lib/fauna.mjs";
import { commonQueryOptions } from "../../lib/command-helpers.mjs";

async function createDatabase(argv) {
  const logger = container.resolve("logger");
  const runV10Query = container.resolve("runV10Query");

  try {
    await runV10Query({
      url: argv.url,
      secret: argv.secret,
      query: fql`Database.create({
        name: ${argv.name},
        protected: ${argv.protected ?? null},
        typechecked: ${argv.typechecked ?? null},
        priority: ${argv.priority ?? null},
      })`,
    });
    logger.stdout(`Database ${argv.name} created`);
  } catch (e) {
    if (e instanceof FaunaError) {
      throwForV10Error(e, {
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
      ...commonQueryOptions,
      name: {
        type: "string",
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
    .demandOption("name")
    .version(false)
    .help("help", "show help");
}

export default {
  command: "create",
  description: "Creates a database",
  builder: buildCreateCommand,
  handler: createDatabase,
};

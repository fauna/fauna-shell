//@ts-check

import { fql } from "fauna";
import { container } from "../../cli.mjs";
import { runV10Query } from "../../lib/fauna.mjs";
import { commonQueryOptions } from "../../lib/command-helpers.mjs";

async function createDatabase(argv) {
  const logger = container.resolve("logger");

  await runV10Query({
    url: argv.url,
    secret: argv.secret,
    query: fql`Database.create({
      name: ${argv.name},
      protected: ${argv.protected ?? false},
      typechecked: ${argv.typechecked ?? false}
    })`,
  });

  logger.stdout(`Database ${argv.name} created`);
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
        type: "boolean",
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

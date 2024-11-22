//@ts-check

import { container } from "../../cli.mjs";

async function createDatabase(argv) {
  const logger = container.resolve("logger");
  logger.stdout(`TBD`);
}

function buildCreateCommand(yargs) {
  return yargs
    .options({
      name: {
        type: "string",
        description: "the name of the database to create",
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

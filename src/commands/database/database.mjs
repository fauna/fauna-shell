//@ts-check

import listCommand from "./list.mjs";
import createCommand from "./create.mjs";
import deleteCommand from "./delete.mjs";
import { container } from "../../cli.mjs";
import { commonQueryOptions } from "../../lib/command-helpers.mjs";

function validateArgs(argv) {
  const logger = container.resolve("logger");

  if (argv.secret && argv.database) {
    // Providing a database and secret are conflicting options. If both are provided,
    // it is not clear which one to use.
    throw new Error(
      "Cannot use both the '--secret' and '--database' options together. Please specify only one.",
    );
  } else if (argv.role && argv.secret) {
    // The '--role' option is not supported when using a secret. Secrets have an
    // implicit role.
    logger.warn(
      "The '--role' option is not supported when using a secret. It will be ignored.",
    );
  }
  return true;
}

function buildDatabase(yargs) {
  return yargs
    .options(commonQueryOptions)
    .check(validateArgs)
    .command(listCommand)
    .command(createCommand)
    .command(deleteCommand)
    .demandCommand()
    .version(false)
    .help("help", "show help");
}

export default {
  command: "database",
  aliases: ["db"],
  describe: "Interact with your databases",
  builder: buildDatabase,
  // eslint-disable-next-line no-empty-function
  handler: () => {},
};

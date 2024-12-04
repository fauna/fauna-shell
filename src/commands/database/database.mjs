//@ts-check

import { yargsWithCommonQueryOptions } from "../../lib/command-helpers.mjs";
import createCommand from "./create.mjs";
import deleteCommand from "./delete.mjs";
import listCommand from "./list.mjs";

function buildDatabase(yargs) {
  return yargsWithCommonQueryOptions(yargs)
    .command(listCommand)
    .command(createCommand)
    .command(deleteCommand)
    .demandCommand()
    .version(false)
    .help("help", "Show help.");
}

export function validateSecretOrDatabase(argv) {
  // Makes sure the user has provided either a secret or a database so we can
  // successfully authenticate them.
  if (!argv.secret && !argv.database) {
    throw new Error(
      "No secret or database provided. Please use either --secret or --database.",
    );
  }
  return true;
}

export default {
  command: "database <method>",
  aliases: ["db"],
  describe: "Create and manage databases.",
  builder: buildDatabase,
  // eslint-disable-next-line no-empty-function
  handler: () => {},
};

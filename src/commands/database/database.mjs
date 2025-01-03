//@ts-check

import {
  ACCOUNT_OPTIONS,
  CORE_OPTIONS,
  DATABASE_PATH_OPTIONS,
} from "../../lib/options.mjs";
import createCommand from "./create.mjs";
import deleteCommand from "./delete.mjs";
import listCommand from "./list.mjs";

function buildDatabase(yargs) {
  return yargs
    .options(ACCOUNT_OPTIONS)
    .options(CORE_OPTIONS)
    .options(DATABASE_PATH_OPTIONS)
    .command(listCommand)
    .command(createCommand)
    .command(deleteCommand)
    .demandCommand();
}

export default {
  command: "database <method>",
  aliases: ["db"],
  describe: "Create and manage databases.",
  builder: buildDatabase,
  // eslint-disable-next-line no-empty-function
  handler: () => {},
};

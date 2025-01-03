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

//@ts-check

import abandonCommand from "./abandon.mjs";
import commitCommand from "./commit.mjs";
import diffCommand from "./diff.mjs";
import pullCommand from "./pull.mjs";
import pushCommand from "./push.mjs";
import statusCommand from "./status.mjs";
import { validateDatabaseOrSecret } from "../../lib/command-helpers.mjs";

export const localSchemaOptions = {
  "project-directory": {
    alias: ["directory", "dir"],
    type: "string",
    description:
      "Path to a local directory containing `.fsl` files for the database.",
    default: ".",
  },
};

function buildSchema(yargs) {
  return yargs
    .command(abandonCommand)
    .command(commitCommand)
    .command(diffCommand)
    .command(pushCommand)
    .command(pullCommand)
    .command(statusCommand)
    .check(validateDatabaseOrSecret)
    .demandCommand();
}

export default {
  command: "schema <method>",
  describe: "Manage a database's schema.",
  builder: buildSchema,
  // eslint-disable-next-line no-empty-function
  handler: () => {},
};

//@ts-check

import { validateDatabaseOrSecret } from "../../lib/middleware.mjs";
import {
  ACCOUNT_OPTIONS,
  CORE_OPTIONS,
  DATABASE_PATH_OPTIONS,
} from "../../lib/options.mjs";
import abandonCommand from "./abandon.mjs";
import commitCommand from "./commit.mjs";
import diffCommand from "./diff.mjs";
import pullCommand from "./pull.mjs";
import pushCommand from "./push.mjs";
import statusCommand from "./status.mjs";

export const LOCAL_SCHEMA_OPTIONS = {
  "fsl-directory": {
    alias: ["directory", "dir"],
    type: "string",
    description:
      "Path to a local directory containing .fsl files for the database.",
    default: ".",
  },
};

function buildSchema(yargs) {
  return yargs
    .options(ACCOUNT_OPTIONS)
    .options(DATABASE_PATH_OPTIONS)
    .options(CORE_OPTIONS)
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

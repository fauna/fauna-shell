//@ts-check

import abandonCommand from "./abandon.mjs";
import commitCommand from "./commit.mjs";
import diffCommand from "./diff.mjs";
import pullCommand from "./pull.mjs";
import pushCommand from "./push.mjs";
import statusCommand from "./status.mjs";

function buildSchema(yargs) {
  return yargs
    .options({
      "project-directory": {
        alias: ["directory", "dir"],
        type: "string",
        description:
          "The path to the project directory containing the schema files to interact with.",
        default: ".",
      },
    })
    .command(abandonCommand)
    .command(commitCommand)
    .command(diffCommand)
    .command(pushCommand)
    .command(pullCommand)
    .command(statusCommand)
    .demandCommand()
    .version(false)
    .help("help", "Show help.");
}

export default {
  command: "schema <method>",
  describe: "Manage a database's schema.",
  builder: buildSchema,
  // eslint-disable-next-line no-empty-function
  handler: () => {},
};

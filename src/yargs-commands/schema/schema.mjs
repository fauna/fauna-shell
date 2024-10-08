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
    .help("help", "show help");
}

export default {
  command: "schema",
  describe: "Manipulate Fauna schema state",
  builder: buildSchema,
  handler: () => {},
};

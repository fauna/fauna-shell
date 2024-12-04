//@ts-check

import createCommand from "./create.mjs";

function buildKeyCommand(yargs) {
  console.log("KEY COMMAND");
  return yargs
    .command(createCommand)
    .demandCommand()
    .help("help", "show help");
}

export default {
  command: "key <method>",
  describe: "Create and manage database keys",
  builder: buildKeyCommand,
  handler: () => {},
};

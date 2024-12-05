//@ts-check

import createCommand from "./create.mjs";

function buildKeyCommand(yargs) {
  return yargs.command(createCommand).demandCommand().help("help", "show help");
}

export default {
  command: "key <method>",
  describe: "Create and manage database keys",
  builder: buildKeyCommand,
  handler: () => {}, // eslint-disable-line no-empty-function
};

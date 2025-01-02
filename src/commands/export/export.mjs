import { yargsWithCommonOptions } from "../../lib/command-helpers.mjs";
import createCommand from "./create.mjs";

function buildExportCommand(yargs) {
  return yargsWithCommonOptions(yargs).command(createCommand);
}

export default {
  command: "export <method>",
  description: "Create and manage database exports.",
  builder: buildExportCommand,
  // eslint-disable-next-line no-empty-function
  handler: () => {},
};

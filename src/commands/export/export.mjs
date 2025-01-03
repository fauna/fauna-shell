import {
  ACCOUNT_AUTHENTICATION_OPTIONS,
  ACCOUNT_OPTIONS,
} from "../../lib/command-helpers.mjs";
import createCommand from "./create.mjs";

function buildExportCommand(yargs) {
  return yargs
    .options(ACCOUNT_AUTHENTICATION_OPTIONS)
    .options(ACCOUNT_OPTIONS)
    .command(createCommand);
}

export default {
  command: "export <method>",
  description: "Create and manage database exports.",
  builder: buildExportCommand,
  // eslint-disable-next-line no-empty-function
  handler: () => {},
};

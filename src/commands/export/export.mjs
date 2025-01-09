import { ValidationError } from "../../lib/errors.mjs";
import { ACCOUNT_OPTIONS } from "../../lib/options.mjs";
import createCommand from "./create.mjs";
import getCommand from "./get.mjs";
import listCommand from "./list.mjs";

/**
 * Validates the arguments do not include Core API authentication options.
 * In the CLI, we don't validate unknown options, but because these commands are unique and
 * only used the Account API, we aggressively validate the options here to avoid confusion.
 * @param {import("yargs").Arguments} argv
 * @returns {boolean}
 */
function validateAccountOnlyOptions(argv) {
  const { secret, local } = argv;

  if (local) {
    throw new ValidationError(
      "Exports do not support --local and the Fauna docker container.",
    );
  }

  if (secret) {
    throw new ValidationError("Exports are not supported with --secret.");
  }

  return true;
}

function buildExportCommand(yargs) {
  return yargs
    .options(ACCOUNT_OPTIONS)
    .check(validateAccountOnlyOptions)
    .command(createCommand)
    .command(listCommand)
    .command(getCommand);
}

export default {
  command: "export <method>",
  description: "Create and manage database exports.",
  builder: buildExportCommand,
  // eslint-disable-next-line no-empty-function
  handler: () => {},
};

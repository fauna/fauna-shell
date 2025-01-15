import chalk from "chalk";

import { container } from "../../config/container.mjs";
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
      "Exports do not support --local or Fauna containers.",
    );
  }

  if (secret) {
    throw new ValidationError("Exports do not support --secret.");
  }

  return true;
}

function buildExportCommand(yargs) {
  return yargs
    .options(ACCOUNT_OPTIONS)
    .middleware(() => {
      const logger = container.resolve("logger");
      logger.stderr(
        chalk.yellow(
          `Warning: fauna export is currently in beta. To learn more, visit https://docs.fauna.com/fauna/current/build/cli/v4/commands/export/`,
        ),
      );
    })
    .check(validateAccountOnlyOptions)
    .command(createCommand)
    .command(listCommand)
    .command(getCommand)
    .example([
      [
        "$0 export create s3 --database us/my_db --bucket my-bucket --path exports/my_db",
        "Export the 'us-std/my_db' database to the 'exports/my_db' path of the 'my-bucket' S3 bucket. Outputs the export ID.",
      ],
      [
        "$0 export get 123456789",
        "Output the YAML for the export with an ID of '123456789'.",
      ],
      ["$0 export list", "List exports in TSV format."],
    ])
    .demandCommand();
}

export default {
  command: "export <method>",
  description: "Create and manage exports.",
  builder: buildExportCommand,
};

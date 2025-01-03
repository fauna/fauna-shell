// @ts-check

import { container } from "../../cli.mjs";
import { DATABASE_PATH_OPTIONS } from "../../lib/command-helpers.mjs";
import { ValidationError } from "../../lib/errors.mjs";
import { FaunaAccountClient } from "../../lib/fauna-account-client.mjs";
import { colorize, Format } from "../../lib/formatting/colorize.mjs";

async function createS3Export(argv) {
  const logger = container.resolve("logger");
  const { database, path, bucket, format, json, color } = argv;
  const accountClient = new FaunaAccountClient();

  const response = await accountClient.createExport({
    database,
    destination: {
      s3: {
        bucket,
        path,
      },
    },
    format,
  });

  if (json) {
    logger.stdout(colorize(response, { color, format: Format.JSON }));
  } else {
    logger.stdout(response.id);
  }
}

function buildCreateS3ExportCommand(yargs) {
  return yargs
    .options({
      bucket: {
        type: "string",
        required: true,
        description: "Name of the bucket to export to.",
      },
      path: {
        type: "string",
        required: true,
        description: "Key prefix to export to.",
      },
      format: {
        type: "string",
        required: true,
        description: "Format to export to.",
        choices: ["simple", "tagged", "decorated"],
        default: "simple",
      },
    })
    .check((argv) => {
      const { secret, local, database } = argv;

      if (local) {
        throw new ValidationError(
          "Exports do not support --local and the Fauna docker container.",
        );
      }

      if (secret) {
        throw new ValidationError(
          "Exports are not supported with --secret. Use --database instead.",
        );
      }

      if (!database) {
        throw new ValidationError(
          "--database is required to create an export.",
        );
      }

      return true;
    })
    .example([
      [
        "$0 export create s3 --bucket my-bucket --path my-prefix",
        "Create an export to the 'my-bucket' bucket with the 'my-prefix' key prefix in simple format.",
      ],
    ]);
}

function buildCreateCommand(yargs) {
  return yargs.options(DATABASE_PATH_OPTIONS).command({
    command: "s3",
    description: "Create a database export to an S3 bucket.",
    builder: buildCreateS3ExportCommand,
    handler: createS3Export,
  });
}

export default {
  command: "create <destination>",
  description: "Create a database export to a given destination.",
  builder: buildCreateCommand,
  // eslint-disable-next-line no-empty-function
  handler: () => {},
};

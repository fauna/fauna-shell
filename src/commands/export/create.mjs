// @ts-check

import { container } from "../../config/container.mjs";
import { ValidationError } from "../../lib/errors.mjs";
import { colorize, Format } from "../../lib/formatting/colorize.mjs";
import { DATABASE_PATH_OPTIONS } from "../../lib/options.mjs";

async function createS3Export(argv) {
  const logger = container.resolve("logger");
  const {
    database,
    path,
    bucket,
    format,
    json,
    color,
    collection: collections,
  } = argv;
  const { createExport } = container.resolve("accountAPI");

  const response = await createExport({
    database,
    collections,
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
        group: "API:",
      },
      path: {
        type: "string",
        required: true,
        description: "Key prefix to export to.",
        group: "API:",
      },
      format: {
        type: "string",
        required: true,
        description: "Format to export to.",
        choices: ["simple", "tagged"],
        default: "simple",
        group: "API:",
      },
    })
    .check((argv) => {
      if (!argv.database) {
        throw new ValidationError(
          "--database is required to create an export.",
        );
      }

      return true;
    })
    .example([
      [
        "$0 export create s3 -d us/my_db --bucket my-bucket --path my-prefix",
        "Output the ID of a new export for the database us-std/my_db to the 'my-bucket' bucket with the 'my-prefix' key prefix in simple format.",
      ],
      [
        "$0 export create s3 -d us/my_db --bucket my-bucket --path my-prefix --json",
        "Output the full JSON of a new export for the database us-std/my_db to the 'my-bucket' bucket with the 'my-prefix' key prefix in simple format.",
      ],
      [
        "$0 export create s3 -d us/my_db --bucket my-bucket --path my-prefix --collection my-collection",
        "Output the ID of a new export for my-collection in us-std/my_db database to the 'my-bucket' bucket with the 'my-prefix' key prefix in simple format.",
      ],
      [
        "$0 export create s3 -d us/my_db --bucket my-bucket --path my-prefix --format tagged",
        "Output the ID of a new export in the tagged format for the database us-std/my_db to the 'my-bucket' bucket with the 'my-prefix' key prefix.",
      ],
    ]);
}

function buildCreateCommand(yargs) {
  return yargs
    .options(DATABASE_PATH_OPTIONS)
    .options({
      collection: {
        type: "array",
        required: false,
        description:
          "The name of the collections to export. If empty, all collections will be exported.",
        default: [],
        group: "API:",
      },
    })
    .command({
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

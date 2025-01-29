// @ts-check

import { container } from "../../config/container.mjs";
import { ValidationError } from "../../lib/errors.mjs";
import { colorize, Format } from "../../lib/formatting/colorize.mjs";
import { DATABASE_PATH_OPTIONS, FORMAT_OPTIONS } from "../../lib/options.mjs";
import { WAIT_OPTIONS, waitUntilExportIsReady } from "./wait.mjs";

async function createS3Export(argv) {
  const {
    database,
    path,
    bucket,
    format,
    json,
    color,
    collection: collections,
    wait,
    maxWait,
    quiet,
    destination,
    idempotency,
  } = argv;
  const logger = container.resolve("logger");
  const { createExport } = container.resolve("accountAPI");
  let destinationInput = destination;
  if (!destinationInput) {
    destinationInput = {
      s3: {
        bucket,
        path,
      },
    };
  }

  let createdExport = await createExport({
    database,
    collections,
    destination: destinationInput,
    format,
    idempotency,
  });

  if (wait && !createdExport.is_terminal) {
    createdExport = await waitUntilExportIsReady({
      id: createdExport.id,
      opts: {
        maxWait,
        quiet,
      },
    });
  }
  if (json) {
    logger.stdout(colorize(createdExport, { color, format: Format.JSON }));
  } else {
    logger.stdout(colorize(createdExport, { color, format: Format.YAML }));
  }
}

const sharedExamples = [
  [
    "$0 export create s3 --destination s3://doc-example-bucket/exports/my_db",
    "Export the 'us-std/my_db' database to the S3 URI 's3://doc-example-bucket/exports/my_db'.",
  ],
  [
    "$0 export create s3 --bucket doc-example-bucket --path exports/my_db",
    "You can also specify the S3 location using --bucket and --path options rather than --destination.",
  ],
  [
    "$0 export create s3 --destination s3://doc-example-bucket/my-prefix --idempotency f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "Set an idempotency key. Avoids reprocessing successful requests with the same key for 24 hours",
  ],
  [
    "$0 export create s3 --destination s3://doc-example-bucket/my-prefix --json",
    "Output the full JSON of the export request.",
  ],
  [
    "$0 export create s3 --destination s3://doc-example-bucket/my-prefix --collection my-collection",
    "Export the 'my-collection' collection only.",
  ],
  [
    "$0 export create s3 --destination s3://doc-example-bucket/my-prefix --format tagged",
    "Encode the export's document data using the 'tagged' format.",
  ],
  [
    "$0 export create s3 --destination s3://doc-example-bucket/my-prefix --wait --max-wait 180",
    "Wait for the export to complete or fail before exiting. Waits up to 180 minutes.",
  ],
];

const S3_URI_REGEX = /^s3:\/\/[^/]+\/.+$/;

function buildCreateS3ExportCommand(yargs) {
  return yargs
    .options(FORMAT_OPTIONS)
    .options({
      destination: {
        alias: ["uri", "destination-uri"],
        type: "string",
        required: false,
        description: "S3 URI in the format s3://bucket/path.",
        group: "API:",
      },
      bucket: {
        type: "string",
        required: false,
        description: "Name of the S3 bucket where the export will be stored.",
        group: "API:",
      },
      path: {
        type: "string",
        required: false,
        description:
          "Path prefix for the S3 bucket. Separate subfolders using a slash (`/`).",
        group: "API:",
      },
      format: {
        type: "string",
        required: true,
        description:
          "Data format used to encode the exported FQL document data as JSON.",
        choices: ["simple", "tagged"],
        default: "simple",
        group: "API:",
      },
      idempotency: {
        type: "string",
        required: false,
        description:
          "Idempotency key. Avoids reprocessing successful requests with the same key for 24 hours.",
        group: "API:",
      },
    })
    .options(WAIT_OPTIONS)
    .check((argv) => {
      if (!argv.database) {
        throw new ValidationError(
          "--database is required to create an export.",
        );
      }
      if (argv.destination) {
        if (argv.bucket || argv.path) {
          throw new ValidationError(
            "Cannot specify --destination with --bucket or --path. Use either --destination or both --bucket and --path.",
          );
        }
        if (!S3_URI_REGEX.test(argv.destination)) {
          throw new ValidationError(
            "Invalid S3 URI format. Expected format: s3://bucket/path",
          );
        }
      } else if (!argv.bucket || !argv.path) {
        throw new ValidationError(
          "Either --destination or both --bucket and --path are required to create an export.",
        );
      }
      if (argv.idempotency?.trim() === "") {
        throw new ValidationError("--idempotency can't be an empty string.");
      }
      return true;
    })
    .example(sharedExamples);
}

function buildCreateCommand(yargs) {
  return yargs
    .options(DATABASE_PATH_OPTIONS)
    .options({
      collection: {
        type: "array",
        required: false,
        description:
          "Used-defined collections to export. Pass values as a space-separated list. If omitted, all user-defined collections are exported.",
        default: [],
        group: "API:",
      },
    })
    .command({
      command: "s3",
      description: "Export to an S3 bucket.",
      builder: buildCreateS3ExportCommand,
      handler: createS3Export,
    })
    .example(sharedExamples)
    .demandCommand();
}

export default {
  command: "create <destination-type>",
  description:
    "Start the export of a database or collections. Outputs the export ID.",
  builder: buildCreateCommand,
};

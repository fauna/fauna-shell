// @ts-check

import { container } from "../../config/container.mjs";
import { EXPORT_TERMINAL_STATES } from "../../lib/account-api.mjs";
import { ValidationError } from "../../lib/errors.mjs";
import { colorize, Format } from "../../lib/formatting/colorize.mjs";
import { DATABASE_PATH_OPTIONS } from "../../lib/options.mjs";
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
  } = argv;
  const logger = container.resolve("logger");
  const { createExport } = container.resolve("accountAPI");

  let createdExport = await createExport({
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

  if (wait && !EXPORT_TERMINAL_STATES.includes(createdExport.state)) {
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
    "$0 export create s3 --database us/my_db --bucket doc-example-bucket --path exports/my_db",
    "Export the 'us-std/my_db' database to the 'exports/my_db' path of the 'doc-example-bucket' S3 bucket. Outputs the export ID.",
  ],
  [
    "$0 export create s3 --database us/my_db --bucket doc-example-bucket --path my-prefix --json",
    "Output the full JSON of the export request.",
  ],
  [
    "$0 export create s3 --database us/my_db --bucket doc-example-bucket --path my-prefix --collection my-collection",
    "Export the 'my-collection' collection only.",
  ],
  [
    "$0 export create s3 --database us/my_db --bucket doc-example-bucket --path my-prefix --format tagged",
    "Encode the export's document data using the 'tagged' format.",
  ],
  [
    "$0 export create s3 --database us/my_db --bucket doc-example-bucket --path my-prefix --wait --max-wait 180",
    "Wait for the export to complete or fail before exiting. Waits up to 180 minutes.",
  ],
];

function buildCreateS3ExportCommand(yargs) {
  return yargs
    .options({
      bucket: {
        type: "string",
        required: true,
        description: "Name of the S3 bucket where the export will be stored.",
        group: "API:",
      },
      path: {
        type: "string",
        required: true,
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
    })
    .options(WAIT_OPTIONS)
    .check((argv) => {
      if (!argv.database) {
        throw new ValidationError(
          "--database is required to create an export.",
        );
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

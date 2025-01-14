import { container } from "../../config/container.mjs";
import { colorize, Format } from "../../lib/formatting/colorize.mjs";

async function getExport(argv) {
  const logger = container.resolve("logger");
  const { getExport } = container.resolve("accountAPI");
  const { exportId, json, color } = argv;

  const response = await getExport({ exportId });

  if (json) {
    logger.stdout(colorize(response, { color, format: Format.JSON }));
  } else {
    logger.stdout(colorize(response, { color, format: Format.YAML }));
  }
}

function buildGetExportCommand(yargs) {
  return yargs
    .positional("exportId", {
      type: "string",
      description: "The ID of the export to get.",
      nargs: 1,
      required: true,
    })
    .example([
      [
        "$0 export get 420099555438101069",
        "Output the YAML for the export with an ID of 420099555438101069.",
      ],
      [
        "$0 export get 420099555438101069 --json",
        "Output the JSON for the export with an ID of 420099555438101069.",
      ],
    ]);
}

export default {
  command: "get <exportId>",
  description: "Get an export by ID.",
  builder: buildGetExportCommand,
  handler: getExport,
};

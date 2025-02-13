import { container } from "../../config/container.mjs";
import { colorize, Format } from "../../lib/formatting/colorize.mjs";
import { FORMAT_OPTIONS } from "../../lib/options.mjs";
import { WAIT_OPTIONS, waitUntilExportIsReady } from "./wait.mjs";

async function getExport(argv) {
  const logger = container.resolve("logger");
  const { getExport } = container.resolve("accountAPI");
  const { exportId, json, color, wait, maxWait, quiet } = argv;

  let response = await getExport({ exportId });
  if (wait && !response.is_terminal) {
    response = await waitUntilExportIsReady({
      id: exportId,
      opts: {
        maxWait,
        quiet,
      },
    });
  }

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
      description: "ID of the export to retrieve.",
      nargs: 1,
      required: true,
    })
    .options(WAIT_OPTIONS)
    .options(FORMAT_OPTIONS)
    .example([
      [
        "$0 export get 123456789",
        "Output the YAML for the export with an ID of '123456789'.",
      ],
      ["$0 export get 123456789 --json", "Output the export as JSON."],
      [
        "$0 export get 123456789 --wait",
        "Wait for the export to complete or fail before exiting.",
      ],
    ]);
}

export default {
  command: "get <exportId>",
  description: "Get an export by ID.",
  builder: buildGetExportCommand,
  handler: getExport,
};

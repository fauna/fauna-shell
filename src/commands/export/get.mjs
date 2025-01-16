import { container } from "../../config/container.mjs";
import { EXPORT_TERMINAL_STATES } from "../../lib/account-api.mjs";
import { colorize, Format } from "../../lib/formatting/colorize.mjs";
import { WAIT_OPTIONS, waitUntilExportIsReady } from "./wait.mjs";

async function getExport(argv) {
  const logger = container.resolve("logger");
  const { getExport } = container.resolve("accountAPI");
  const { exportId, json, color, wait, maxWait, quiet } = argv;

  let response = await getExport({ exportId });
  if (wait && !EXPORT_TERMINAL_STATES.includes(response.state)) {
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
    .example([
      [
        "$0 export get 123456789",
        "Output the YAML for the export with an ID of '123456789'.",
      ],
      ["$0 export get 123456789 --json", "Output the export as JSON."],
      [
        "$0 export get 123456789 --wait",
        "Wait for the export to be in a terminal state before exiting.",
      ],
    ]);
}

export default {
  command: "get <exportId>",
  description: "Get an export by ID.",
  builder: buildGetExportCommand,
  handler: getExport,
};

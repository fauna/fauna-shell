import { container } from "../../config/container.mjs";
import { EXPORT_STATES } from "../../lib/account-api.mjs";
import { colorize, Format } from "../../lib/formatting/colorize.mjs";
import { FORMAT_OPTIONS } from "../../lib/options.mjs";

const COLUMN_SEPARATOR = "\t";
const COLLECTION_SEPARATOR = ",";

async function listExports(argv) {
  const logger = container.resolve("logger");
  const { json, color, maxResults, state } = argv;
  const { listExports } = container.resolve("accountAPI");

  const { results } = await listExports({
    maxResults,
    state: state,
  });

  if (json) {
    logger.stdout(colorize(results, { color, format: Format.JSON }));
  } else {
    if (!results.length) {
      return;
    }

    results.forEach((r) => {
      const row = [
        r.id,
        r.database,
        (r.collections ?? []).join(COLLECTION_SEPARATOR),
        r.destination.uri,
        r.state,
      ];
      logger.stdout(
        colorize(row.join(COLUMN_SEPARATOR), {
          color,
          format: Format.TSV,
        }),
      );
    });
  }
}

function buildListExportsCommand(yargs) {
  return yargs
    .options(FORMAT_OPTIONS)
    .options({
      "max-results": {
        alias: "max",
        type: "number",
        description: "Maximum number of exports to return. Defaults to 10.",
        default: 10,
        group: "API:",
      },
      state: {
        type: "array",
        description: "Filter exports by state.",
        default: [],
        group: "API:",
        choices: EXPORT_STATES,
      },
    })
    .example([
      [
        "$0 export list",
        "List exports in TSV format with export ID, database, collections, destination, and state as the columns.",
      ],
      ["$0 export list --json", "List exports in JSON format."],
      ["$0 export list --max-results 50", "List up to 50 exports."],
      [
        "$0 export list --states Pending Complete",
        "List exports in the 'Pending' or 'Complete' state.",
      ],
    ]);
}

export default {
  command: "list",
  describe: "List exports.",
  builder: buildListExportsCommand,
  handler: listExports,
};

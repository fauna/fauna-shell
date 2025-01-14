import { container } from "../../config/container.mjs";
import { colorize, Format } from "../../lib/formatting/colorize.mjs";

const COLUMN_SEPARATOR = "\t";
const COLLECTION_SEPARATOR = ", ";
const COLUMN_HEADERS = [
  "id",
  "database",
  "collections",
  "destination_uri",
  "state",
];

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

    logger.stdout(
      colorize(COLUMN_HEADERS.join(COLUMN_SEPARATOR), {
        color,
        format: Format.TSV,
      }),
    );

    results.forEach((r) => {
      const row = [
        r.id,
        r.database,
        (r.collections ?? []).join(COLLECTION_SEPARATOR),
        r.destination_uri,
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
    .options({
      "max-results": {
        alias: "max",
        type: "number",
        description: "Maximum number of exports to return. Defaults to 100.",
        default: 100,
        group: "API:",
      },
      state: {
        type: "array",
        description: "Filter exports by state.",
        default: [],
        group: "API:",
        choices: ["Pending", "InProgress", "Complete", "Failed"],
      },
    })
    .example([
      ["$0 export list", "List exports in TSV format."],
      ["$0 export list --max-results 100", "List a max of 100 exports."],
      ["$0 export list --json", "List exports in JSON format."],
      ["$0 export list --states Pending", "List exports in the Pending state."],
    ]);
}

export default {
  command: "list",
  describe: "List database exports.",
  builder: buildListExportsCommand,
  handler: listExports,
};

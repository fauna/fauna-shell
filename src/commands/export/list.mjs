import { container } from "../../config/container.mjs";
import { colorize, Format } from "../../lib/formatting/colorize.mjs";

/* eslint-disable camelcase */
/**
 * Converts an export object to a CSV string.
 * @param {{ id: string, database: string, created_at: string, updated_at: string, state: string }} export
 * @returns {string}
 */
function exportToCSV({ id, database, created_at, updated_at, state }) {
  return `${database},${id},${created_at},${updated_at},${state}`;
}
/* eslint-enable camelcase */

/**
 * Outputs the exports to the console.
 * @param {Object} params - The parameters for outputting the exports.
 * @param {Function} params.stdout - The function to use for outputting the exports.
 * @param {string[]} params.exports - The exports to output.
 * @param {boolean} params.color - Whether to colorize the output.
 */
export function outputExports({ stdout, exports, color }) {
  if (!exports || exports.length === 0) {
    return;
  }

  stdout(
    colorize(
      exportToCSV({
        id: "id",
        database: "database",
        state: "state",
        /* eslint-disable camelcase */
        created_at: "created_at",
        updated_at: "updated_at",
        /* eslint-enable camelcase */
      }),
      { color, format: Format.CSV },
    ),
  );

  exports.forEach((r) => {
    stdout(colorize(exportToCSV(r), { color, format: Format.CSV }));
  });
}

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
    logger.stdout(
      colorize(
        ["database", "id", "created_at", "updated_at", "state"].join(","),
        { color, format: Format.CSV },
      ),
    );

    results.forEach((r) => {
      const { database, id, state, created_at, updated_at } = r; // eslint-disable-line camelcase
      logger.stdout(
        colorize(
          [database, id, created_at, updated_at, state].join(","), // eslint-disable-line camelcase
          {
            color,
            format: Format.CSV,
          },
        ),
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
      ["$0 export list", "List exports in CSV format."],
      ["$0 export list --max-results 100", "List a max of 100 exports."],
      ["$0 export list --json", "List exports in JSON format."],
      ["$0 export list --states Pending", "List exports in Pending state."],
    ]);
}

export default {
  command: "list",
  describe: "List database exports.",
  builder: buildListExportsCommand,
  handler: listExports,
};

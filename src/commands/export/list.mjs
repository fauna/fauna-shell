import { container } from "../../cli.mjs";
import {
  ACCOUNT_AUTHENTICATION_OPTIONS,
  ACCOUNT_OPTIONS,
} from "../../lib/command-helpers.mjs";
import { FaunaAccountClient } from "../../lib/fauna-account-client.mjs";
import { colorize, Format } from "../../lib/formatting/colorize.mjs";

/* eslint-disable camelcase */
/**
 * Converts an export object to a CSV string.
 * @param {{ id: string, database: string, created_at: string, updated_at: string, state: string }} export
 * @returns {string}
 */
function toCSV({ id, database, created_at, updated_at, state }) {
  return `${id},${database},${created_at},${updated_at},${state}`;
}
/* eslint-enable camelcase */

async function listExports(argv) {
  const logger = container.resolve("logger");
  const accountClient = new FaunaAccountClient();
  const { json, color, maxResults } = argv;

  const { results } = await accountClient.listExports({
    maxResults,
  });

  if (json) {
    logger.stdout(colorize(results, { color, format: Format.JSON }));
  } else {
    if (!results || results.length === 0) {
      return;
    }

    logger.stdout(
      toCSV({
        id: "id",
        database: "database",
        state: "state",
        /* eslint-disable camelcase */
        created_at: "created_at",
        updated_at: "updated_at",
        /* eslint-enable camelcase */
      }),
    );

    results.forEach((r) => {
      logger.stdout(toCSV(r));
    });
  }
}

function buildListExportsCommand(yargs) {
  return yargs
    .options(ACCOUNT_AUTHENTICATION_OPTIONS)
    .options(ACCOUNT_OPTIONS)
    .options({
      "max-results": {
        alias: "max",
        type: "number",
        description: "Maximum number of exports to return. Defaults to 16.",
        default: 16,
        group: "API:",
      },
    })
    .example([
      ["$0 export list", "List exports in CSV format."],
      ["$0 export list --max-results 100", "List a max of 100 exports."],
      ["$0 export list --json", "List exports in JSON format."],
    ]);
}

export default {
  command: "list",
  describe: "List database exports.",
  builder: buildListExportsCommand,
  handler: listExports,
};

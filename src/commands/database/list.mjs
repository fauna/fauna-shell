//@ts-check

import { container } from "../../cli.mjs";
import { faunaToCommandError } from "../../lib/fauna.mjs";
import { FaunaAccountClient } from "../../lib/fauna-account-client.mjs";
import { colorize, Format } from "../../lib/formatting/colorize.mjs";

// Narrow the output fields based on the provided flags.
const getOutputFields = (argv) => {
  if (!argv.secret && !argv.database) {
    // If we are listing top level databases the region group
    // needs to be included as database names can be re-used across
    // regions.
    return ["name", "region_group"];
  }
  return ["name"];
};

function pickOutputFields(databases, argv) {
  return databases.map((d) =>
    getOutputFields(argv).reduce((acc, field) => {
      acc[field] = d[field];
      return acc;
    }, {}),
  );
}

async function listDatabasesWithAccountAPI(argv) {
  const { pageSize, database } = argv;
  const accountClient = new FaunaAccountClient();
  const response = await accountClient.listDatabases({
    pageSize,
    path: database,
  });
  return pickOutputFields(response.results, argv);
}

async function listDatabasesWithSecret(argv) {
  const { url, secret, pageSize } = argv;
  const { runQueryFromString } = container.resolve("faunaClientV10");

  try {
    return await runQueryFromString({
      url,
      secret,
      // This gives us back an array of database names. If we want to
      // provide the after token at some point this query will need to be updated.
      expression: `Database.all().paginate(${pageSize}).data { ${getOutputFields(argv)} }`,
    });
  } catch (e) {
    return faunaToCommandError(e);
  }
}

export async function listDatabases(argv) {
  let databases;
  if (argv.secret) {
    databases = await listDatabasesWithSecret(argv);
  } else {
    databases = await listDatabasesWithAccountAPI(argv);
  }
  return databases;
}

async function doListDatabases(argv) {
  const logger = container.resolve("logger");
  const { formatQueryResponse } = container.resolve("faunaClientV10");
  const res = await listDatabases(argv);
  if (argv.secret) {
    logger.stdout(formatQueryResponse(res, argv));
  } else {
    logger.stdout(colorize(res, { format: Format.JSON, color: argv.color }));
  }
}

function buildListCommand(yargs) {
  return yargs
    .options({
      pageSize: {
        type: "number",
        description: "Maximum number of databases to return.",
        default: 1000,
      },
    })
    .example([
      ["$0 database list", "List all top-level databases."],
      [
        "$0 database list --database us/example",
        "List all child databases directly under the 'us/example' database.",
      ],
      [
        "$0 database list --secret my-secret",
        "List all child databases directly under a database scoped to a secret.",
      ],
      [
        "$0 database list --json",
        "List all top-level databases and output as JSON.",
      ],
      [
        "$0 database list --pageSize 10",
        "List the first 10 top-level databases.",
      ],
    ]);
}

export default {
  command: "list",
  description: "List databases.",
  builder: buildListCommand,
  handler: doListDatabases,
};

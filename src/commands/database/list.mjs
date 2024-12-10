//@ts-check

import { FaunaError } from "fauna";

import { container } from "../../cli.mjs";
import { yargsWithCommonQueryOptions } from "../../lib/command-helpers.mjs";
import { throwForError } from "../../lib/fauna.mjs";
import { FaunaAccountClient } from "../../lib/fauna-account-client.mjs";
import { colorize, JSON_FORMAT } from "../../lib/formatting/colorize.mjs";

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
  const { pageSize, database, color } = argv;
  const accountClient = new FaunaAccountClient();
  const response = await accountClient.listDatabases({
    pageSize,
    path: database,
  });
  const output = pickOutputFields(response.results, argv);

  container.resolve("logger").stdout(
    colorize(output, {
      format: JSON_FORMAT,
      color: color,
    }),
  );
}

async function listDatabasesWithSecret(argv) {
  const { url, secret, pageSize, color } = argv;
  const { runQueryFromString, formatQueryResponse } =
    container.resolve("faunaClientV10");

  try {
    const result = await runQueryFromString({
      url,
      secret,
      // This gives us back an array of database names. If we want to
      // provide the after token at some point this query will need to be updated.
      expression: `Database.all().paginate(${pageSize}).data { ${getOutputFields(argv)} }`,
    });
    container
      .resolve("logger")
      .stdout(formatQueryResponse(result, { format: JSON_FORMAT, color }));
  } catch (e) {
    if (e instanceof FaunaError) {
      throwForError(e);
    }
    throw e;
  }
}

async function listDatabases(argv) {
  if (argv.secret) {
    return listDatabasesWithSecret(argv);
  } else {
    return listDatabasesWithAccountAPI(argv);
  }
}

function buildListCommand(yargs) {
  return yargsWithCommonQueryOptions(yargs)
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
  handler: listDatabases,
};

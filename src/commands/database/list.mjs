//@ts-check

import { FaunaError } from "fauna";

import { container } from "../../cli.mjs";
import { throwForError } from "../../lib/fauna.mjs";
import { yargsWithCommonQueryOptions } from "../../lib/command-helpers.mjs";
import { FaunaAccountClient } from "../../lib/fauna-account-client.mjs";

const OUTPUT_FIELDS = ["name"];

function pickOutputFields(databases) {
  return databases.map((d) =>
    OUTPUT_FIELDS.reduce((acc, field) => {
      acc[field] = d[field];
      return acc;
    }, {}),
  );
}

async function listDatabasesWithAccountAPI(argv) {
  const { pageSize, database, json } = argv;
  const accountClient = new FaunaAccountClient();
  const response = await accountClient.listDatabases({
    pageSize,
    path: database,
  });
  const output = pickOutputFields(response.results);
  if (json) {
    container.resolve("logger").stdout(JSON.stringify(output));
  } else {
    container.resolve("logger").stdout(output);
  }
}

async function listDatabasesWithSecret(argv) {
  const { url, secret, pageSize, json } = argv;
  const { runQueryFromString, formatQueryResponse } =
    container.resolve("faunaClientV10");

  try {
    const result = await runQueryFromString({
      url,
      secret,
      // This gives us back an array of database names. If we want to
      // provide the after token at some point this query will need to be updated.
      expression: `Database.all().paginate(${pageSize}).data { ${OUTPUT_FIELDS} }`,
    });
    container.resolve("logger").stdout(formatQueryResponse(result, { json }));
  } catch (e) {
    if (e instanceof FaunaError) {
      throwForError(e);
    }
    throw e;
  }
}

async function listDatabases(argv) {
  if (argv.secret) {
    listDatabasesWithSecret(argv);
  } else {
    listDatabasesWithAccountAPI(argv);
  }
}

function buildListCommand(yargs) {
  return yargsWithCommonQueryOptions(yargs)
    .options({
      pageSize: {
        type: "number",
        default: 1000,
      },
    })
    .help("help", "show help")
    .example([
      ["$0 database list", "list all databases"],
      [
        "$0 database list --database us-std/example",
        "list all databases under us-std/example",
      ],
      [
        "$0 database list --secret 'my-secret'",
        "list all databases using the provided database secret",
      ],
      ["$0 database list --json", "list all databases and output as JSON"],
      ["$0 database list --pageSize 10", "list the first 10 databases"],
    ]);
}

export default {
  command: "list",
  description: "Lists your databases",
  builder: buildListCommand,
  handler: listDatabases,
};

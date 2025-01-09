//@ts-check
import chalk from "chalk";

import { container } from "../../config/container.mjs";
import { faunaToCommandError } from "../../lib/fauna.mjs";
import { colorize, Format } from "../../lib/formatting/colorize.mjs";

async function listDatabasesWithAccountAPI(argv) {
  const { pageSize, database } = argv;
  const { listDatabases } = container.resolve("accountAPI");
  const response = await listDatabases({
    pageSize,
    path: database,
  });

  return response.results.map(({ path, name }) => ({ path, name }));
}

async function listDatabasesWithSecret(argv) {
  const { url, secret, pageSize } = argv;
  const { runQueryFromString } = container.resolve("faunaClientV10");

  try {
    const res = await runQueryFromString({
      url,
      secret,
      // This gives us back an array of database names. If we want to
      // provide the after token at some point this query will need to be updated.
      expression: `Database.all().paginate(${pageSize}).data { name }`,
    });
    return res.data;
  } catch (e) {
    return faunaToCommandError({ err: e, color: argv.color });
  }
}

export async function listDatabases(argv) {
  if (argv.secret) {
    return await listDatabasesWithSecret(argv);
  } else {
    return await listDatabasesWithAccountAPI(argv);
  }
}

async function doListDatabases(argv) {
  const logger = container.resolve("logger");
  const res = await listDatabases(argv);

  if (argv.secret) {
    logger.stderr(
      chalk.yellow(
        "Warning: Full database paths are not available when using --secret. Use --database if a full path, including the Region Group identified and hierarchy, is needed.",
      ),
    );
  }

  if (argv.json) {
    logger.stdout(colorize(res, { format: Format.JSON, color: argv.color }));
  } else {
    res.forEach(({ path, name }) => {
      logger.stdout(path ?? name);
    });
  }
}

function buildListCommand(yargs) {
  return yargs
    .options({
      "page-size": {
        type: "number",
        description: "Maximum number of databases to return.",
        default: 1000,
      },
    })
    .example([
      ["$0 database list", "List all top-level databases."],
      [
        "$0 database list --database us/parent_db",
        "List all child databases directly under the 'us/parent_db' database.",
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
        "$0 database list --page-size 10",
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

//@ts-check

import { container } from "../../cli.mjs";
import { commonQueryOptions } from "../../lib/command-helpers.mjs";
import { FaunaAccountClient } from "../../lib/fauna-account-client.mjs";
import { performQuery } from "../eval.mjs";

async function listDatabases(argv) {
  const logger = container.resolve("logger");

  // query the account api
  const accountClient = new FaunaAccountClient();
  const databases = await accountClient.listDatabases();
  logger.stdout(databases);

  // query the fauna api
  const dbClient = await container.resolve("getSimpleClient")(argv);
  const result = await performQuery(dbClient, "Database.all()", undefined, {
    ...argv,
    format: "json",
  });
  logger.stdout(result);

  // see what credentials are being used
  const credentials = container.resolve("credentials");
  logger.debug(
    `
    Account Key: ${credentials.accountKeys.key}\n
    Database Key: ${credentials.databaseKeys.key}`,
    "creds",
  );
}

function buildListCommand(yargs) {
  return yargs
    .options({
      ...commonQueryOptions,
    })
    .help("help", "show help");
}

export default {
  command: "list",
  description: "Lists your databases",
  builder: buildListCommand,
  handler: listDatabases,
};

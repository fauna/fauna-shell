//@ts-check

import { container } from "../../cli.mjs";
import { commonQueryOptions } from "../../lib/command-helpers.mjs";
import { FaunaAccountClient } from "../../lib/fauna-account-client.mjs";

async function listDatabases() {
  const logger = container.resolve("logger");

  // query the account api
  const accountClient = new FaunaAccountClient();
  const databases = await accountClient.listDatabases();
  logger.stdout(databases);

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

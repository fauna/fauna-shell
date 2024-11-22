//@ts-check

import { container } from "../../cli.mjs";

async function listDatabases(argv) {
  const profile = argv.profile;
  const logger = container.resolve("logger");
  const accountClient = container.resolve("accountClient");
  const accountCreds = container.resolve("accountCreds");
  const accountKey = accountCreds.get({ key: profile }).accountKey;
  const databases = await accountClient.listDatabases(accountKey);
  logger.stdout(databases);
}

function buildListCommand(yargs) {
  return yargs.version(false).help("help", "show help");
}

export default {
  command: "list",
  description: "Lists your databases",
  builder: buildListCommand,
  handler: listDatabases,
};

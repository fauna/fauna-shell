//@ts-check

import { container } from "../cli.mjs";

async function listDatabases(profile) {
  const logger = container.resolve("logger");
  const accountClient = container.resolve("accountClient");
  const accountCreds = container.resolve("accountCreds");
  const accountKey = accountCreds.get({ key: profile }).accountKey;
  logger.stdout("Listing Databases...");
  const databases = await accountClient.listDatabases(accountKey);
  logger.stdout(databases);
}

function buildDatabaseCommand(yargs) {
  return yargs
    .positional("method", {
      type: "string",
      choices: ["create", "list", "delete"],
      describe: "choose a method to interact with your databases",
    })
    .options({
      profile: {
        type: "string",
        description: "a user profile",
        default: "default",
      },
    })
    .help("help", "show help")
    .example([["$0 db list"]]);
}

function databaseHandler(argv) {
  const logger = container.resolve("logger");
  const method = argv.method;
  switch (method) {
    case "create":
      logger.stdout("Creating database...");
      break;
    case "delete":
      logger.stdout("Deleting database...");
      break;
    case "list":
      listDatabases(argv.profile);
      break;
    default:
      break;
  }
}

export default {
  command: "database <method>",
  aliases: ["db"],
  description: "Interact with your databases:",
  builder: buildDatabaseCommand,
  handler: databaseHandler,
};

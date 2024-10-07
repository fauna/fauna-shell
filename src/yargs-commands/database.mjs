import { container } from "../cli.mjs";

async function listDatabases(profile) {
  const logger = container.resolve("logger");
  const accountClient = container.resolve("accountClient");
  const accountCreds = container.resolve("accountCreds");
  const account_key = accountCreds.get(profile).account_key;
  logger.stdout("Listing Databases...");
  const databases = await accountClient.listDatabases(account_key);
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
  const method = argv.method;
  switch (method) {
    case "create":
      console.log("Creating database...");
      break;
    case "delete":
      console.log("Deleting database...");
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

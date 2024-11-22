//@ts-check

import { container } from "../cli.mjs";
import { performQuery } from "./eval.mjs";

async function listDatabases(profile) {
  const logger = container.resolve("logger");
  const AccountClient = container.resolve("AccountClient");
  logger.stdout("Listing Databases...");
  const databases = await new AccountClient(profile).listDatabases();
  logger.stdout(databases);
}

async function createDatabase(argv) {
  const client = await container.resolve("getSimpleClient")(argv);
  const logger = container.resolve("logger");
  // performQuery only gives us an error code if we ask for the json-tagged format.
  //  so gotta go deeper to keep it agnostic of the format.
  // And it can't be only on initial client init, because repl needs to
  //  refresh on the fly w/out kicking out.
  const result = await performQuery(client, "1 + 1", undefined, {
    ...argv,
    format: "json-tagged",
  });
  const result2 = await performQuery(client, "2 + 2", undefined, {
    ...argv,
    format: "json-tagged",
  });
  logger.stdout(result, result2);
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
      authRequired: {
        default: true,
      },
      url: {
        type: "string",
        description: "the Fauna URL to query",
        default: "https://db.fauna.com:443",
      },
      secret: {
        type: "string",
        description: "the secret to use",
        // default: "somesecret",
      },
    })
    .help("help", "show help")
    .example([["$0 db list"]]);
}

async function databaseHandler(argv) {
  const logger = container.resolve("logger");
  const method = argv.method;
  let result;
  switch (method) {
    case "create":
      logger.stdout("Creating database...");
      result = await createDatabase(argv);
      break;
    case "delete":
      logger.stdout("Deleting database...");
      break;
    case "list":
      result = await listDatabases(argv.profile);
      break;
    default:
      break;
  }
  return result;
}

export default {
  command: "database <method>",
  aliases: ["db"],
  description: "Interact with your databases:",
  builder: buildDatabaseCommand,
  handler: databaseHandler,
};

//@ts-check

import { container } from "../cli.mjs";
import { FaunaAccountClient } from "../lib/fauna-account-client.mjs";

async function createKey(argv) {
  const logger = container.resolve("logger");
  const AccountClient = new FaunaAccountClient();
  const { database, role, ttl } = argv;
  const databaseKey = await AccountClient.createKey({
    path: database,
    role,
    ttl,
  });
  logger.stdout(
    `Created key for ${database} with role ${role}\n${JSON.stringify(databaseKey)}`,
  );
}

function buildKeyCommand(yargs) {
  return yargs
    .positional("method", {
      type: "string",
      choices: ["create", "list", "delete"],
      describe: "choose a method to interact with your databases",
    })
    .options({
      url: {
        type: "string",
        description: "the Fauna URL to query",
        default: "https://db.fauna.com:443",
      },
      role: {
        alias: "r",
        type: "string",
        default: "admin",
        describe: "The role to assign to the key",
      },
    })
    .help("help", "show help")
    .example([["$0 key create"]]);
}

function keyHandler(argv) {
  const method = argv.method;
  const logger = container.resolve("logger");

  switch (method) {
    case "create":
      createKey(argv);
      break;
    case "delete":
      logger.stdout("Deleting key...");
      break;
    case "list":
      logger.stdout("Listing keys...");
      break;
    default:
      break;
  }
}

export default {
  command: "key <method>",
  description: "Interact with your database keys:",
  builder: buildKeyCommand,
  handler: keyHandler,
};

//@ts-check

import { container } from "../cli.mjs";

async function createKey(argv) {
  const logger = container.resolve("logger");
  const AccountClient = container.resolve("accountClient");
  // const accountKey = await getAccountKey(profile);
  // TODO: after logging in, should we list the top level databases and create db keys for them?
  //  depending on how many top level dbs....
  // Have to list DBs on login so we know which databases are top-level and require frontdoor calls

  // TODO: we should create the key with fauna unless it's a top level key
  // in which case we should create it with the account client

  // TODO: when using fauna to create a key at the specified database path, we should
  //  getDBKey(parent path).
  // const dbSecret = getDBKey({
  //   accountKey,
  //   path: database,
  //   role,
  // });
  // logger.stdout("got account key", accountKey);
  // logger.stdout("got db secret", dbSecret);
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

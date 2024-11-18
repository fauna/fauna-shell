import { container } from "../cli.mjs";
import {
  authNZMiddleware,
  getAccountKey,
  getDBKey,
} from "../lib/auth/authNZ.mjs";

async function createKey(argv) {
  const { database, profile, role, url, local } = argv;
  const logger = container.resolve("logger");
  const accountClient = container.resolve("accountClient");
  const accountKey = await getAccountKey(profile);
  const key = await accountClient.createKey({
    accountKey,
    path: database,
    role,
  });
  logger.stdout(`Key created:\n${JSON.stringify(key, null, 2)}`);
}

function buildKeyCommand(yargs) {
  return yargs
    .positional("method", {
      type: "string",
      choices: ["create", "list", "delete"],
      describe: "choose a method to interact with your databases",
    })
    .options({
      // TODO: make this a common option after new authNZ is in place
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
      authRequired: {
        default: true,
      },
    })
    .help("help", "show help")
    .example([["$0 key create"]]);
}

function keyHandler(argv) {
  const method = argv.method;
  switch (method) {
    case "create":
      createKey(argv);
      break;
    case "delete":
      console.log("Deleting key...");
      break;
    case "list":
      console.log("Listing keys...");
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

import { container } from "../cli.mjs";
import {
  checkAccountKeyRemote,
  checkDBKeyRemote,
  getAccountKeyLocal,
  getDBKeyLocal,
} from "../lib/auth/authNZ.mjs";

// TODO: this function should just spit out the secret that was created.
//  consider an optional flag that will save this secret to the creds file, overwriting
//  the existing secret if it exists at key/path/role
async function createKey(argv) {
  const { database, profile, role, url, local } = argv;
  const logger = container.resolve("logger");
  const accountClient = container.resolve("accountClient");
  const secretCreds = container.resolve("secretCreds");
  const accountKey = getAccountKeyLocal(profile);
  await checkAccountKeyRemote(accountKey);
  const existingSecret = getDBKeyLocal({ accountKey, path: database, role });
  const dbSecret =
    existingSecret ??
    (await accountClient.createKey({
      accountKey,
      path: database,
      role,
    }));
  secretCreds.save({
    creds: {
      path: database,
      role,
      secret: dbSecret.secret,
    },
    key: accountKey,
  });
  await checkDBKeyRemote(dbSecret.secret, argv.url);
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

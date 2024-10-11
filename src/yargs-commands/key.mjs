import { container } from "../cli.mjs";

async function createKey(profile) {
  const logger = container.resolve("logger");
  const accountClient = container.resolve("accountClient");
  const accountCreds = container.resolve("accountCreds");
  const secretCreds = container.resolve("secretCreds");
  const account_key = accountCreds.get(profile).account_key;
  console.log(accountCreds.get());
  console.log(account_key);
  logger.stdout("Creating key...");
  const databases = await accountClient.createKey(account_key);
  logger.stdout(databases);
}

function buildKeyCommand(yargs) {
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
    .example([["$0 key create"]]);
}

function keyHandler(argv) {
  const method = argv.method;
  switch (method) {
    case "create":
      createKey(argv.profile);
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

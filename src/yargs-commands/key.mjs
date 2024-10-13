import { container } from "../cli.mjs";

async function createKey(argv) {
  const { database, profile, role } = argv;
  console.log("db and profile", database, profile);
  const logger = container.resolve("logger");
  const accountClient = container.resolve("accountClient");
  const accountCreds = container.resolve("accountCreds");
  const secretCreds = container.resolve("secretCreds");
  const accountKey = accountCreds.get({ key: profile }).account_key;
  console.log("Account key", accountKey);
  const dbSecret = await accountClient.createKey({
    accountKey,
    path: database,
    role,
  });
  console.log("Key created: ", dbSecret);
  secretCreds.save({ creds: dbSecret, key: accountKey });
  console.log("Getting secrets", secretCreds.get());
  console.log("Secrets for key", secretCreds.get({ key: accountKey }));
  console.log(
    "Secrets for path",
    secretCreds.get({ key: accountKey, path: database }),
  );
  console.log(
    "Secrets for role",
    secretCreds.get({ key: accountKey, path: database, role }),
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

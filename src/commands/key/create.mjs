import { container } from "../../cli.mjs";
import { FaunaAccountClient } from "../../lib/fauna-account-client.mjs";
import { yargsWithCommonQueryOptions } from "../../lib/command-helpers.mjs";
import { Settings, DateTime } from "luxon";
import { formatObject } from "../../lib/misc.mjs";

Settings.defaultZone = "utc";

async function createKey(argv) {
  console.log("createKey");
  if (argv.secret) {
    return createKeyWithSecret(argv);
  }
  return createKeyWithAccountApi(argv);
}

async function createKeyWithSecret(argv) {
  const logger = container.resolve("logger");
  logger.stderr("TODO");
}

async function createKeyWithAccountApi(argv) {
  console.log("createKeyWithAccountApi");
  const AccountClient = new FaunaAccountClient();
  const { database, role, ttl, name, json, color } = argv;
  const databaseKey = await AccountClient.createKey({
    path: database,
    role,
    ttl,
    name,
  });
  const { path: _, ...rest } = databaseKey;
  container.resolve("logger").stdout(formatObject(rest));
}

function buildCreateCommand(yargs) {
  console.log("buildCreateCommand");
  return yargsWithCommonQueryOptions(yargs)
    .options({
      name: {
        type: "string",
        required: false,
        description: "The name of the key",
      },
      ttl: {
        type: "string",
        required: false,
        description: "The time-to-live for the key. Provide as an ISO 8601 date time string.",
      }
    })
    .default("role", "admin")
    .demandOption(["database"])
    .check((argv) => {
      console.log("Checking");
      if (argv.ttl && !DateTime.fromISO(argv.ttl).isValid) {
        console.log("no bueno");
        throw new Error(`Invalid ttl '${argv.ttl}'. Provide as an ISO 8601 date time string.`);
      }
      return true;
    })
    .help("help", "show help");
}

export default {
  command: "create",
  describe: "Create a key for a database",
  builder: buildCreateCommand,
  handler: createKey,
}

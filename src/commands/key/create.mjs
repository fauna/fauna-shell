import { DateTime, Settings } from "luxon";

import { container } from "../../cli.mjs";
import { yargsWithCommonQueryOptions } from "../../lib/command-helpers.mjs";
import { FaunaAccountClient } from "../../lib/fauna-account-client.mjs";
import { formatObject } from "../../lib/misc.mjs";

Settings.defaultZone = "utc";

async function createKey(argv) {
  if (argv.secret) {
    return createKeyWithSecret(argv);
  }
  return createKeyWithAccountApi(argv);
}

async function createKeyWithSecret(/*argv*/) {
  const logger = container.resolve("logger");
  logger.stderr("TODO");
}

async function createKeyWithAccountApi(argv) {
  const AccountClient = new FaunaAccountClient();
  const { database, role, ttl, name /*json, color*/ } = argv;
  const databaseKey = await AccountClient.createKey({
    path: database,
    role,
    ttl,
    name,
  });
  const { /*path: _,*/ ...rest } = databaseKey;
  container.resolve("logger").stdout(formatObject(rest));
}

function buildCreateCommand(yargs) {
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
        description:
          "The time-to-live for the key. Provide as an ISO 8601 date time string.",
      },
    })
    .default("role", "admin")
    .demandOption(["database"])
    .check((argv) => {
      if (argv.ttl && !DateTime.fromISO(argv.ttl).isValid) {
        throw new Error(
          `Invalid ttl '${argv.ttl}'. Provide as an ISO 8601 date time string.`,
        );
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
};

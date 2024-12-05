import { DateTime, Settings } from "luxon";

import { container } from "../../cli.mjs";
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
  const accountClient = new FaunaAccountClient();
  const { database, keyRole, ttl, name } = argv;
  const databaseKey = await accountClient.createKey({
    path: database,
    role: keyRole,
    ttl,
    name,
  });
  const { path: db, ...rest } = databaseKey;
  container.resolve("logger").stdout(formatObject({ ...rest, database: db}, argv));
}

function buildCreateCommand(yargs) {
  return yargs
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
      keyRole: {
        type: "string",
        required: true,
        description: "The role to assign to the key; e.g. admin",
      },
    })
    .check((argv) => {
      if (argv.ttl && !DateTime.fromISO(argv.ttl).isValid) {
        throw new Error(
          `Invalid ttl '${argv.ttl}'. Provide as an ISO 8601 date time string.`,
        );
      }
      if (argv.database === undefined && argv.secret === undefined) {
        throw new Error(
          "You must provide at least one of: --database, --secret, --local.",
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

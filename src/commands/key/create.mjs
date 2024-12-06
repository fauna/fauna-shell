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
  container
    .resolve("logger")
    .stdout(formatObject({ ...rest, database: db }, argv));
}

function buildCreateCommand(yargs) {
  return yargs
    .options({
      name: {
        type: "string",
        required: false,
        description: "Name for the key.",
      },
      ttl: {
        type: "string",
        required: false,
        description:
          "Time-to-live for the key as an ISO 8601 timestamp. Example: 2099-12-06T00:01:32.021Z. Keys without a ttl don't expire.",
      },
      keyRole: {
        type: "string",
        required: true,
        description: "Role assigned to the key, such as 'admin' or 'server'.",
      },
    })
    .check((argv) => {
      if (argv.ttl && !DateTime.fromISO(argv.ttl).isValid) {
        throw new Error(
          `Invalid ttl '${argv.ttl}'. Provide a valid ISO 8601 timestamp.`,
        );
      }
      if (argv.database === undefined && argv.secret === undefined) {
        throw new Error(
          "You must provide at least one of: --database, --secret, --local.",
        );
      }
      return true;
    })
    .help("help", "Show help.")
    .example([
      [
        "$0 key create --name foo --keyRole admin  --database us/example",
        "Create a key named 'foo' with the 'admin' role for the 'us/example' database.",
      ],
      [
        "$0 key create --keyRole server --secret my-secret",
        "Create a key with the 'server' role for the database scoped to a secret.",
      ],
      [
        "$0 key create --keyRole server --ttl 2099-12-06T00:01:32.021Z",
        "Create a key with a ttl.",
      ],
    ]);
}

export default {
  command: "create",
  describe: "Create a key for a database",
  builder: buildCreateCommand,
  handler: createKey,
};

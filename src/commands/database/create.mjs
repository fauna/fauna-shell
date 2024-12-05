//@ts-check

import { FaunaError } from "fauna";

import { container } from "../../cli.mjs";
import { throwForError } from "../../lib/fauna.mjs";
import { getSecret, retryInvalidCredsOnce } from "../../lib/fauna-client.mjs";
import { formatObjectForShell } from "../../lib/misc.mjs";
import { validateDatabaseOrSecret } from "../../lib/command-helpers.mjs";

function validate(argv) {
  validateDatabaseOrSecret(argv);
  return true;
}

async function runCreateQuery(secret, argv) {
  const { fql } = container.resolve("fauna");
  const { runQuery } = container.resolve("faunaClientV10");
  return runQuery({
    secret,
    url: argv.url,
    query: fql`
      Database.create({
        name: ${argv.name},
        protected: ${argv.protected ?? null},
        typechecked: ${argv.typechecked ?? null},
        priority: ${argv.priority ?? null},
      })`,
  });
}

async function createDatabase(argv) {
  const secret = await getSecret();
  const logger = container.resolve("logger");

  try {
    await retryInvalidCredsOnce(secret, async (secret) =>
      runCreateQuery(secret, argv),
    );

    logger.stderr(`Database successfully created.`);

    const { color, json } = argv;
    if (json) {
      logger.stdout(formatObjectForShell({ name: argv.name }, { color }));
    } else {
      logger.stdout(argv.name);
    }
  } catch (e) {
    if (e instanceof FaunaError) {
      throwForError(e, {
        onConstraintFailure: () =>
          `Constraint failure: The database '${argv.name}' may already exists or one of the provided options may be invalid.`,
      });
    }
    throw e;
  }
}

function buildCreateCommand(yargs) {
  return yargs
    .options({
      name: {
        type: "string",
        required: true,
        description: "Name of the database to create.",
      },
      typechecked: {
        type: "string",
        description:
          "Enable typechecking for the database. Defaults to the typechecking setting of the parent database.",
      },
      protected: {
        type: "boolean",
        description:
          "Enable protected mode for the database. Protected mode disallows destructive schema changes.",
      },
      priority: {
        type: "number",
        description: "User-defined priority for the database.",
      },
    })
    .check(validate)
    .help("help", "show help")
    .example([
      [
        "$0 database create --name 'my-database' --database 'us/example'",
        "Create a database named 'my-database' under `us/example`.",
      ],
      [
        "$0 database create --name 'my-database' --secret 'my-secret'",
        "Create a database named 'my-database' scoped to a secret.",
      ],
    ]);
}

export default {
  command: "create",
  description: "Create a child database.",
  builder: buildCreateCommand,
  handler: createDatabase,
};

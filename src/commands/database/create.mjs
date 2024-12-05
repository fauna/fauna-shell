//@ts-check

import { FaunaError } from "fauna";

import { container } from "../../cli.mjs";
import { throwForError } from "../../lib/fauna.mjs";
import { getSecret, retryInvalidCredsOnce } from "../../lib/fauna-client.mjs";
import { formatObjectForShell } from "../../lib/misc.mjs";
import { validateDatabaseOrSecret } from "../../lib/command-helpers.mjs";

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
          `Constraint failure: The database '${argv.name}' already exists or one of the provided options is invalid.`,
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
        description: "Name of the child database to create.",
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
    .check(validateDatabaseOrSecret)
    .help("help", "show help")
    .example([
      [
        "$0 database create --name my_database --database us/example",
        "Create a database named 'my_database' directly under 'us/example'.",
      ],
      [
        "$0 database create --name my_database --secret my-secret",
        "Create a database named 'my_database' directly under the database scoped to a secret.",
      ],
      [
        "$0 database create --name my_database --database us/example --typechecked",
        "Create a database with typechecking enabled.",
      ],
      [
        "$0 database create --name my_database --database us/example --protected",
        "Create a database with protected mode enabled.",
      ],
    ]);
}

export default {
  command: "create",
  description: "Create a child database.",
  builder: buildCreateCommand,
  handler: createDatabase,
};

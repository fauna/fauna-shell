//@ts-check

import { FaunaError } from "fauna";

import { container } from "../../cli.mjs";
import { throwForError } from "../../lib/fauna.mjs";
import { formatObjectForShell } from "../../lib/misc.mjs";
import { getSecret, retryInvalidCredsOnce } from "../../lib/fauna-client.mjs";

function validate(argv) {
  if (!argv.secret && !argv.database) {
    throw new Error(
      "No secret or database provided. Please use either --secret or --database.",
    );
  }
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
    if (argv.secret === secret) {
      // If we are using a user provided secret, we should not
      // try to refresh it if it is bad.
      await runCreateQuery(secret, argv);
    } else {
      await retryInvalidCredsOnce(secret, async (secret) =>
        runCreateQuery(secret, argv),
      );
    }

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
    .version(false)
    .help("help", "show help")
    .example([
      [
        "$0 database create --name 'my-database' --database 'us-std/example'",
        "Create a database named 'my-database' under `us-std/example`.",
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

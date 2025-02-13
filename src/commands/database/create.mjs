//@ts-check
import { ServiceError } from "fauna";

import { container } from "../../config/container.mjs";
import { CommandError } from "../../lib/errors.mjs";
import { faunaToCommandError } from "../../lib/fauna.mjs";
import { getSecret, retryInvalidCredsOnce } from "../../lib/fauna-client.mjs";
import { colorize, Format } from "../../lib/formatting/colorize.mjs";
import { validateDatabaseOrSecret } from "../../lib/middleware.mjs";
import { FORMAT_OPTIONS } from "../../lib/options.mjs";

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
  const secret = await getSecret(argv);
  const logger = container.resolve("logger");

  try {
    await retryInvalidCredsOnce(secret, async (secret) =>
      runCreateQuery(secret, argv),
    );

    logger.stderr(`Database successfully created.`);

    const { color, json } = argv;
    if (json) {
      logger.stdout(
        colorize({ name: argv.name }, { color, format: Format.JSON }),
      );
    } else {
      logger.stdout(argv.name);
    }
  } catch (e) {
    faunaToCommandError({
      err: e,
      color: argv.color,
      include: argv.include,
      handler: (err) => {
        if (err instanceof ServiceError && err.code === "constraint_failure") {
          const cf = err.constraint_failures;
          if (cf && cf.length > 0) {
            const nameIsInvalidIdentifier = cf.some(
              (failure) =>
                failure?.paths?.length === 1 &&
                failure?.paths?.[0]?.[0] === "name" &&
                failure?.message === "Invalid identifier.",
            );
            if (nameIsInvalidIdentifier) {
              throw new CommandError(
                `The database name '${argv.name}' is invalid. Database names must begin with letters and include only letters, numbers, and underscores.`,
                { cause: err },
              );
            }
          }
          throw new CommandError(
            `The database '${argv.name}' already exists or one of the provided options is invalid.`,
            { cause: err },
          );
        }
      },
    });
  }
}

function buildCreateCommand(yargs) {
  return yargs
    .options(FORMAT_OPTIONS)
    .options({
      name: {
        type: "string",
        required: true,
        description: "Name of the database to create.",
      },
      typechecked: {
        type: "boolean",
        description:
          "Enable typechecking for the database. Use --no-typechecked to disable. Defaults to enabled for top-level databases. Inherits the parent database's setting for child databases.",
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
    .example([
      [
        "$0 database create --name my_db --database us",
        "Create the top-level 'my_db' database in the 'us' region group.",
      ],
      [
        "$0 database create --name child_db --database us/parent_db",
        "Create the 'child_db' child database directly under 'us/parent_db'.",
      ],
      [
        "$0 database create --name child_db --secret my-secret",
        "Create the 'child_db' child database directly under the database scoped to a secret.",
      ],
      [
        "$0 database create --name my_db --database us --typechecked",
        "Create a database with typechecking enabled.",
      ],
      [
        "$0 database create --name my_db --database us --protected",
        "Create a database with protected mode enabled.",
      ],
    ]);
}

export default {
  command: "create",
  description: "Create a database.",
  builder: buildCreateCommand,
  handler: createDatabase,
};

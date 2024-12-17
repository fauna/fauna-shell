import chalk from "chalk";
import { AbortError } from "fauna";

import { container } from "../cli.mjs";
import { pushSchema } from "../commands/schema/push.mjs";
import { ensureContainerRunning } from "../lib/docker-containers.mjs";
import { CommandError, ValidationError } from "../lib/errors.mjs";
import { colorize, Format } from "../lib/formatting/colorize.mjs";

/**
 * Starts the local Fauna container
 * @param {import('yargs').Arguments} argv The arguments from yargs
 * @returns {Promise<void>} a promise that resolves when the container is ready.
 * It will reject if the container is not ready after the maximum number of attempts.
 */
async function startLocal(argv) {
  const color = argv.color;
  await ensureContainerRunning({
    imageName: argv.image,
    containerName: argv.name,
    hostIp: argv.hostIp,
    hostPort: argv.hostPort,
    containerPort: argv.containerPort,
    pull: argv.pull,
    interval: argv.interval,
    maxAttempts: argv.maxAttempts,
    color,
  });
  if (argv.database) {
    await createDatabase(argv);
  }
  if (argv.directory) {
    await createDatabaseSchema(argv);
  }
}

async function createDatabaseSchema(argv) {
  const logger = container.resolve("logger");
  logger.stderr(
    colorize(
      `[CreateDatabaseSchema] Creating schema for database '${argv.database}' from directory '${argv.directory}'...`,
      {
        format: Format.LOG,
        color: argv.color,
      },
    ),
  );
  // hack to let us push schema to the local database
  argv.secret = `secret:${argv.database}:admin`;
  await pushSchema({ ...argv, active: true, input: false });
  logger.stderr(
    colorize(
      `[CreateDatabaseSchema] Schema for database '${argv.database}' created from directory '${argv.directory}'.`,
      {
        format: Format.LOG,
        color: argv.color,
      },
    ),
  );
}

async function createDatabase(argv) {
  const { fql } = container.resolve("fauna");
  const { runQuery } = container.resolve("faunaClientV10");
  const logger = container.resolve("logger");
  const color = argv.color;
  logger.stderr(
    colorize(`[CreateDatabase] Creating database '${argv.database}'...`, {
      format: Format.LOG,
      color,
    }),
  );
  try {
    const db = await runQuery({
      secret: "secret",
      url: `http://${argv.hostIp}:${argv.hostPort}`,
      query: fql`
      let name = ${argv.database}
      let database = Database.byName(name)
      let protected = ${argv.protected ?? null}
      let typechecked = ${argv.typechecked ?? null}
      let priority = ${argv.priority ?? null}
      if (database == null) {
        Database.create({
          name: name,
          protected: protected,
          typechecked: typechecked,
          priority: priority,
        })
      } else if (protected == database.protected && typechecked == database.typechecked && priority == database.priority) {
        database
      } else {
        abort(database)
      }`,
      options: { format: "decorated" },
    });
    logger.stderr(
      colorize(`[CreateDatabase] Database '${argv.database}' created.`, {
        format: Format.LOG,
        color,
      }),
    );
    logger.stderr(colorize(db.data, { format: Format.FQL, color }));
  } catch (e) {
    if (e instanceof AbortError) {
      throw new CommandError(
        `${chalk.red(`[CreateDatabase] Database '${argv.database}' already exists but with differrent properties than requested:\n`)}
-----------------
${colorize(e.abort, { format: Format.FQL, color })}
-----------------
${chalk.red("Please use choose a different name using --name or align the --typechecked, --priority, and --protected with what is currently present.")}`,
      );
    }
    throw e;
  }
}

/**
 * Builds the yargs command for the local command
 * @param {import('yargs').Argv} yargs The yargs instance
 * @returns {import('yargs').Argv} The yargs instance
 */
function buildLocalCommand(yargs) {
  return yargs
    .options({
      "container-port": {
        describe: "The port inside the container Fauna listens on.",
        type: "number",
        default: 8443,
      },
      "host-port": {
        describe:
          "The port on the host machine mapped to the container's port. This is the port you'll connect to Fauna on.",
        type: "number",
        default: 8443,
      },
      "host-ip": {
        describe: `The IP address to bind the container's exposed port on the host.`,
        type: "string",
        default: "0.0.0.0",
      },
      interval: {
        describe:
          "The interval (in milliseconds) between health check attempts. Determines how often the CLI checks if the Fauna container is ready.",
        type: "number",
        default: 10000,
      },
      "max-attempts": {
        describe:
          "The maximum number of health check attempts before declaring the start Fauna continer process as failed.",
        type: "number",
        default: 100,
      },
      name: {
        describe: "The name to give the container.",
        type: "string",
        default: "faunadb",
      },
      pull: {
        describe: "Pull the latest image before starting the container.",
        type: "boolean",
        default: true,
      },
      database: {
        describe:
          "The name of a database to create in the container. Omit to create no database.",
        type: "string",
      },
      typechecked: {
        describe:
          "Enable typechecking for the database. Valid only if --database is set.",
        type: "boolean",
      },
      protected: {
        describe:
          "Enable protected mode for the database. Protected mode disallows destructive schema changes. Valid only if --database is set.",
        type: "boolean",
      },
      priority: {
        type: "number",
        description:
          "User-defined priority for the database. Valid only if --database is set.",
      },
      "project-directory": {
        type: "string",
        alias: ["dir", "directory"],
        description:
          "Path to a local directory containing `.fsl` files for the database. Valid only if --database is set.",
      },
    })
    .check((argv) => {
      if (argv.maxAttempts < 1) {
        throw new ValidationError("--max-attempts must be greater than 0.");
      }
      if (argv.interval < 0) {
        throw new ValidationError(
          "--interval must be greater than or equal to 0.",
        );
      }
      if (argv.typechecked && !argv.database) {
        throw new ValidationError(
          "--typechecked can only be set if --database is set.",
        );
      }
      if (argv.protected && !argv.database) {
        throw new ValidationError(
          "--protected can only be set if --database is set.",
        );
      }
      if (argv.priority && !argv.database) {
        throw new ValidationError(
          "--priority can only be set if --database is set.",
        );
      }
      if (argv.directory && !argv.database) {
        throw new ValidationError(
          "--directory,--dir can only be set if --database is set.",
        );
      }
      return true;
    });
}

export default {
  command: "local",
  describe: "Start a local Fauna container.",
  builder: buildLocalCommand,
  handler: startLocal,
};

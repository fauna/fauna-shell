import chalk from "chalk";
import { AbortError } from "fauna";

import { pushSchema } from "../commands/schema/push.mjs";
import { container } from "../config/container.mjs";
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

  // In the docker container, typechecked will be false by default if not set.
  // We need to set it to true if it's not set. We can't do it in the options,
  // because we don't want to validate it unless --database is set.
  let typechecked = argv.typechecked;
  if (argv.database && argv.typechecked === undefined) {
    typechecked = true;
  }

  try {
    const db = await runQuery({
      secret: "secret",
      url: `http://${argv.hostIp}:${argv.hostPort}`,
      query: fql`
      let name = ${argv.database}
      let database = Database.byName(name)
      let protected = ${argv.protected ?? null}
      let typechecked = ${typechecked}
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

function validateContainerArgv(argv) {
  if (argv.maxAttempts < 1) {
    throw new ValidationError("--max-attempts must be greater than 0.");
  }
  if (argv.interval < 0) {
    throw new ValidationError("--interval must be greater than or equal to 0.");
  }
}

function validateDatabaseArgv(argv) {
  const dbOnlyArgs = {
    typechecked: "--typechecked",
    protected: "--protected",
    priority: "--priority",
    directory: "--fsl-directory",
  };

  for (const [arg, name] of Object.entries(dbOnlyArgs)) {
    if (argv[arg] !== undefined && !argv.database) {
      throw new ValidationError(
        `${name} can only be set if --database is set.`,
      );
    }
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
        describe: "Port inside the container Fauna listens on.",
        type: "number",
        default: 8443,
      },
      "host-port": {
        describe:
          "Port on the host machine mapped to the container's port. Clients send requests to Fauna on this port.",
        type: "number",
        default: 8443,
      },
      "host-ip": {
        describe: `IP address to bind to the container's exposed port on the host.`,
        type: "string",
        default: "0.0.0.0",
      },
      interval: {
        describe:
          "Interval, in milliseconds, between health check attempts. How often the CLI checks if the container is ready.",
        type: "number",
        default: 10000,
      },
      "max-attempts": {
        describe:
          "Maximum number of health check attempts allowed before container startup fails.",
        type: "number",
        default: 100,
      },
      name: {
        describe: "Name for the container.",
        type: "string",
        default: "faunadb",
      },
      pull: {
        describe: "Pull the latest image before starting the container.",
        type: "boolean",
        default: true,
      },
      database: {
        describe: "Name of the database to create. Omit to create no database.",
        type: "string",
      },
      typechecked: {
        describe:
          "Enable typechecking for the database. Use --no-typechecked to disable. Defaults to enabled. Valid only if --database is set.",
        type: "boolean",
        default: undefined,
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
      "fsl-directory": {
        type: "string",
        alias: ["dir", "directory"],
        description:
          "Path to a local directory containing .fsl files for the database. Valid only if --database is set.",
      },
    })
    .check((argv) => {
      validateContainerArgv(argv);
      validateDatabaseArgv(argv);
      return true;
    })
    .example([
      ["$0 local", "Start a Fauna container with default name and ports."],
      ["$0 local --name local-fauna", "Start a container named 'local-fauna'."],
      [
        "$0 local --host-port 123 --container-port 6789",
        "Map host port `1234` to container port `6789`.",
      ],
      [
        "$0 local --database my_db",
        "Start a local Fauna container with the 'my_db' database.",
      ],
      [
        "$0 local --database my_db --dir /path/to/schema/dir",
        "Start a local Fauna container with a database with specified schema.",
      ],
    ]);
}

export default {
  command: "local",
  describe: "Start a local Fauna container.",
  builder: buildLocalCommand,
  handler: startLocal,
};

import chalk from "chalk";
import { AbortError } from "fauna";

import { container } from "../cli.mjs";
import { ensureContainerRunning } from "../lib/docker-containers.mjs";
import { CommandError } from "../lib/errors.mjs";
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
      containerPort: {
        describe: "The port inside the container Fauna listens on.",
        type: "number",
        default: 8443,
      },
      hostPort: {
        describe:
          "The port on the host machine mapped to the container's port. This is the port you'll connect to Fauna on.",
        type: "number",
        default: 8443,
      },
      hostIp: {
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
      maxAttempts: {
        describe:
          "The maximum number of health check attempts before declaring the start Fauna continer process as failed.",
        type: "number",
        default: 100,
      },
      name: {
        describe: "The name to give the container",
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
    })
    .check((argv) => {
      if (argv.maxAttempts < 1) {
        throw new CommandError("--maxAttempts must be greater than 0.", {
          hideHelp: false,
        });
      }
      if (argv.interval < 0) {
        throw new CommandError(
          "--interval must be greater than or equal to 0.",
          { hideHelp: false },
        );
      }
      if (argv.typechecked && !argv.database) {
        throw new CommandError(
          "--typechecked can only be set if --database is set.",
          { hideHelp: false },
        );
      }
      if (argv.protected && !argv.database) {
        throw new CommandError(
          "--protected can only be set if --database is set.",
          { hideHelp: false },
        );
      }
      if (argv.priority && !argv.database) {
        throw new CommandError(
          "--priority can only be set if --database is set.",
          { hideHelp: false },
        );
      }
      return true;
    });
}

export default {
  command: "local",
  describe: "Start a local Fauna container",
  builder: buildLocalCommand,
  handler: startLocal,
};

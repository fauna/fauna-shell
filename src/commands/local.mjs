import { ensureContainerRunning } from "../lib/docker-containers.mjs";
import { CommandError } from "../lib/errors.mjs";

/**
 * Starts the local Fauna container
 * @param {import('yargs').Arguments} argv The arguments from yargs
 * @returns {Promise<void>} a promise that resolves when the container is ready.
 * It will reject if the container is not ready after the maximum number of attempts.
 */
async function startLocal(argv) {
  await ensureContainerRunning({
    imageName: argv.image,
    containerName: argv.name,
    hostIp: argv.hostIp,
    hostPort: argv.hostPort,
    containerPort: argv.containerPort,
    pull: argv.pull,
    interval: argv.interval,
    maxAttempts: argv.maxAttempts,
    color: argv.color,
  });
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
      return true;
    });
}

export default {
  command: "local",
  describe: "Start a local Fauna container",
  builder: buildLocalCommand,
  handler: startLocal,
};

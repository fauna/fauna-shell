import Docker from "dockerode";

import { container } from "../cli.mjs";

const DOCKER = new Docker();

/**
 * Pulls the latest version of the given image
 * @param {string} imageName The name of the image to pull
 * @returns {Promise<void>} a promise that resolves when the image is pulled. It will
 * reject if there is an error pulling the image.
 */
async function pullImage(imageName) {
  const logger = container.resolve("logger"); // Dependency injection for logger
  logger.stderr(`[PullImage] Pulling the latest version of ${imageName}...\n`);

  try {
    const stream = await DOCKER.pull(imageName);
    const layers = {}; // To track progress by layer
    let numLines = 0; // Tracks the number of lines being displayed
    let lastUpdate = 0;

    return new Promise((resolve, reject) => {
      DOCKER.modem.followProgress(
        stream,
        (err, output) => {
          writePullProgress(layers, numLines);
          if (err) {
            reject(err);
          } else {
            // Move to the reserved space for completion message
            logger.stderr("[PullImage] Pull complete.");
            resolve(output);
          }
        },
        (event) => {
          if (event.id) {
            // Update specific layer progress
            layers[event.id] =
              `${event.id}: ${event.status} ${event.progress || ""}`;
          }
          if (Date.now() - lastUpdate > 100) {
            numLines = writePullProgress(layers, numLines);
            lastUpdate = Date.now();
          }
        },
      );
    });
  } catch (error) {
    logger.stderr(
      `[PullImage] Error pulling image ${imageName}: ${error.message}`,
    );
    throw error;
  }
}

/**
 * Writes the progress of the image pull to stderr.
 * It clears the lines that have already been written and updates them in place
 * so that the progress is displayed in the same place with no "flicker".
 * @param {Object} layers The layers of the image
 * @param {number} numLines The number of lines to clear and update
 * @returns {number} The number of lines written. Pass this value back into
 * the next call to writePullProgress so that it can update the lines in place.
 */
function writePullProgress(layers, numLines) {
  const logger = container.resolve("logger");
  const stderrStream = container.resolve("stderrStream");
  // Clear only the necessary lines and update them in place
  stderrStream.write(`\x1B[${numLines}A`);
  numLines = 0;
  // clear the screen
  stderrStream.write("\x1B[0J");
  Object.values(layers).forEach((line) => {
    logger.stderr(line);
    numLines++;
  });
  return numLines;
}

/**
 * Finds a container by name
 * @param {string} containerName The name of the container to find
 * @returns {Promise<Object>} The container object if found, otherwise undefined.
 * The container object has the following properties:
 * - Id: The ID of the container
 * - Names: The names of the container
 * - State: The state of the container
 */
async function findContainer(containerName) {
  const logger = container.resolve("logger"); // Dependency injection for logger
  logger.stderr(
    `[GetContainerState] Checking state for container '${containerName}'...`,
  );
  const containers = await DOCKER.listContainers({ all: true });
  return containers.find((container) =>
    container.Names.includes(`/${containerName}`),
  );
}

/**
 * Creates a container
 * @param {string} imageName The name of the image to create the container from
 * @param {string} containerName The name of the container to start
 * @param {number} hostPort The port on the host machine mapped to the container's port
 * @param {number} containerPort The port inside the container Fauna listens on
 * @returns {Promise<Object>} The container object
 */
async function createContainer({
  imageName,
  containerName,
  hostPort,
  containerPort,
}) {
  const dockerContainer = await DOCKER.createContainer({
    Image: imageName,
    name: containerName,
    HostConfig: {
      PortBindings: {
        [`${containerPort}/tcp`]: [{ HostPort: hostPort }],
      },
      AutoRemove: true,
    },
    ExposedPorts: {
      [`${containerPort}/tcp`]: {},
    },
  });
  return dockerContainer;
}

/**
 * Starts a container and returns a log stream if the container is not yet running.
 * @param {string} imageName The name of the image to create the container from
 * @param {string} containerName The name of the container to start
 * @param {number} hostPort The port on the host machine mapped to the container's port
 * @param {number} containerPort The port inside the container Fauna listens on
 * @returns {Promise<Object>} The log stream
 */
async function startContainer({
  imageName,
  containerName,
  hostPort,
  containerPort,
}) {
  const logger = container.resolve("logger");
  const existingContainer = await findContainer(containerName);
  let dockerContainer = undefined;
  let logStream = undefined;
  if (existingContainer) {
    dockerContainer = DOCKER.getContainer(existingContainer.Id);
    if (existingContainer.State === "paused") {
      logger.stderr(
        `[StartContainer] Container '${containerName}' exists but is paused. Unpausing it...`,
      );
      await dockerContainer.unpause();
      logStream = await createLogStream({ dockerContainer, containerName });
    } else if (existingContainer.State === "created") {
      logger.stderr(
        `[StartContainer] Container '${containerName}' is created but not started. Starting it...`,
      );
      await dockerContainer.start();
      logStream = await createLogStream({ dockerContainer, containerName });
    } else {
      logger.stderr(
        `[StartContainer] Container '${containerName}' is already running.`,
      );
    }
  } else {
    logger.stderr(`[StartContainer] Starting container '${containerName}'...`);
    dockerContainer = await createContainer({
      imageName,
      containerName,
      hostPort,
      containerPort,
    });
    await dockerContainer.start();
    logStream = await createLogStream({ dockerContainer, containerName });
  }
  return logStream;
}

/**
 * Creates a log stream for the container
 * @param {Object} dockerContainer The container object
 * @param {string} containerName The name of the container
 * @returns {Promise<Object>} The log stream
 */
async function createLogStream({ dockerContainer, containerName }) {
  const logger = container.resolve("logger");
  let logStream = await dockerContainer.logs({
    stdout: true,
    stderr: true,
    follow: true,
    tail: 100, // Get the last 100 lines and start tailing
  });

  // Pipe the logs to your logger
  logStream.on("data", (chunk) => {
    logger.stderr(`[StartContainer][${containerName}] ${chunk.toString()}`);
  });

  logStream.on("end", async () => {
    logger.stderr(
      `[StartContainer] Container '${containerName}' logs have finished.`,
    );
    logStream = await createLogStream({ dockerContainer, containerName });
  });

  logStream.on("error", (error) => {
    logger.stderr(
      `[StartContainer] Error tailing logs for container '${containerName}': ${error.message}`,
    );
  });

  return logStream;
}

/**
 * Waits for the container to be ready
 * @param {string} url The url to check
 * @param {number} maxAttempts The maximum number of attempts to check
 * @param {number} delay The delay between attempts in milliseconds
 * @param {Object} logStream The log stream to destroy when the container is ready
 * @returns {Promise<void>} a promise that resolves when the container is ready.
 * It will reject if the container is not ready after the maximum number of attempts.
 */
async function waitForHealthCheck({
  url,
  maxAttempts = 100,
  delay = 10000,
  logStream,
}) {
  const logger = container.resolve("logger");
  logger.stderr(`[HealthCheck] Waiting for Fauna to be ready at ${url}...`);

  let attemptCounter = 0;

  while (attemptCounter < maxAttempts) {
    try {
      /* eslint-disable-next-line no-await-in-loop */
      const response = await fetch(`${url}/ping`, {
        method: "GET",
        timeout: 1000,
      });
      if (response.ok) {
        logger.stderr(`[HealthCheck] Fauna is ready at ${url}`);
        logStream?.destroy();
        return;
      }
    } catch (error) {
      logger.stderr(
        `[HealthCheck] Fauna is not yet ready. Attempt ${attemptCounter + 1}/${maxAttempts} failed: ${error.message}. Retrying in ${delay / 1000} seconds...`,
      );
    }

    attemptCounter++;
    /* eslint-disable-next-line no-await-in-loop */
    await new Promise((resolve) => {
      setTimeout(resolve, delay);
    });
  }

  logger.stderr(
    `[HealthCheck] Max attempts reached. Service at ${url} did not respond.`,
  );
  throw new Error(
    `[HealthCheck] Fauna at ${url} is not ready after ${maxAttempts} attempts.`,
  );
}

/**
 * Ensures the container is running
 * @param {string} imageName The name of the image to create the container from
 * @param {string} containerName The name of the container to start
 * @param {number} hostPort The port on the host machine mapped to the container's port
 * @param {number} containerPort The port inside the container Fauna listens on
 * @param {boolean} pull Whether to pull the latest image
 * @returns {Promise<void>}
 */
async function ensureContainerRunning({
  imageName,
  containerName,
  hostPort,
  containerPort,
  pull,
}) {
  const logger = container.resolve("logger");
  try {
    if (pull) {
      await pullImage(imageName);
    }
    const logStream = await startContainer({
      imageName,
      containerName,
      hostPort,
      containerPort,
    });
    logger.stderr(
      `[StartContainer] Container '${containerName}' started. Monitoring HealthCheck for readiness.`,
    );
    await waitForHealthCheck({
      url: `http://localhost:${hostPort}`,
      logStream,
    });
    logger.stderr(
      `[ConatinerReady] Container '${containerName}' is up and healthy`,
    );
  } catch (error) {
    logger.stderr(`[StartContainer] Error: ${error.message}`);
    throw error;
  }
}

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
    hostPort: argv.hostPort,
    containerPort: argv.containerPort,
    pull: argv.pull,
  });
}

/**
 * Builds the yargs command for the local command
 * @param {import('yargs').Argv} yargs The yargs instance
 * @returns {import('yargs').Argv} The yargs instance
 */
function buildLocalCommand(yargs) {
  return yargs.options({
    containerPort: {
      describe: "The port inside the container Fauna listens on",
      type: "number",
      default: "8443",
    },
    hostPort: {
      describe:
        "The port on the host machine mapped to the container's port. This is the port you'll connect to Fauna on.",
      type: "number",
      default: "8443",
    },
    image: {
      describe: "The image to run locally",
      type: "string",
      default: "fauna/faunadb:latest",
    },
    name: {
      describe: "The name to give the container",
      type: "string",
      default: "faunadb",
    },
    pull: {
      describe: "Pull the latest image before starting the container",
      type: "boolean",
      default: true,
    },
  });
}

export default {
  command: "local",
  describe: "Start a local Fauna container",
  builder: buildLocalCommand,
  handler: startLocal,
};
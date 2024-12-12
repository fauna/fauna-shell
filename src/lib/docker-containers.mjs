import { container } from "../cli.mjs";
import { CommandError, SUPPORT_MESSAGE } from "./errors.mjs";

const IMAGE_NAME = "fauna/faunadb:latest";

/**
 * Ensures the container is running
 * @param {string} imageName The name of the image to create the container from
 * @param {string} containerName The name of the container to start
 * @param {number} hostPort The port on the host machine mapped to the container's port
 * @param {number} containerPort The port inside the container Fauna listens on
 * @param {boolean} pull Whether to pull the latest image
 * @param {number | undefined} interval The interval (in milliseconds) between health check attempts.
 * @param {number | undefined} maxAttempts The maximum number of health check attempts before
 * declaring the start Fauna continer process as failed.
 * @returns {Promise<void>}
 */
export async function ensureContainerRunning({
  containerName,
  hostPort,
  containerPort,
  pull,
  interval,
  maxAttempts,
}) {
  const logger = container.resolve("logger");
  if (pull) {
    await pullImage(IMAGE_NAME);
  }
  const logStream = await startContainer({
    imageName: IMAGE_NAME,
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
    interval,
    maxAttempts,
  });
  logger.stderr(
    `[ContainerReady] Container '${containerName}' is up and healthy.`,
  );
}

/**
 * Pulls the latest version of the given image
 * @param {string} imageName The name of the image to pull
 * @returns {Promise<void>} a promise that resolves when the image is pulled. It will
 * reject if there is an error pulling the image.
 */
async function pullImage(imageName) {
  const docker = container.resolve("docker");
  const logger = container.resolve("logger"); // Dependency injection for logger
  logger.stderr(`[PullImage] Pulling image '${imageName}'...\n`);

  try {
    const stream = await docker.pull(imageName);
    const layers = {}; // To track progress by layer
    let numLines = 0; // Tracks the number of lines being displayed
    let lastUpdate = 0;

    return new Promise((resolve, reject) => {
      docker.modem.followProgress(
        stream,
        (err, output) => {
          writePullProgress(layers, numLines);
          if (err) {
            reject(err);
          } else {
            // Move to the reserved space for completion message
            logger.stderr(`[PullImage] Image '${imageName}' pulled.`);
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
    throw new CommandError(
      `[PullImage] Failed to pull image '${imageName}': ${error.message}. ${SUPPORT_MESSAGE}`,
      { cause: error },
    );
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
 * @returns {Promise<Object | null>} The container object if found, otherwise undefined.
 * The container object has the following properties:
 * - Id: The ID of the container
 * - Names: The names of the container
 * - State: The state of the container
 */
async function findContainer(containerName) {
  const docker = container.resolve("docker");
  const logger = container.resolve("logger"); // Dependency injection for logger
  logger.stderr(
    `[GetContainerState] Checking state for container '${containerName}'...`,
  );
  const filters = JSON.stringify({ name: [containerName] });
  const containers = await docker.listContainers({ all: true, filters });
  return containers.length > 0 ? containers[0] : null;
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
  const docker = container.resolve("docker");
  const dockerContainer = await docker.createContainer({
    Image: imageName,
    name: containerName,
    HostConfig: {
      PortBindings: {
        [`${containerPort}/tcp`]: [{ HostPort: `${hostPort}` }],
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
  const docker = container.resolve("docker");
  const logger = container.resolve("logger");
  const existingContainer = await findContainer(containerName);
  let logStream = undefined;
  if (existingContainer) {
    const dockerContainer = docker.getContainer(existingContainer.Id);
    const state = existingContainer.State;
    if (state === "paused") {
      logger.stderr(
        `[StartContainer] Container '${containerName}' exists but is paused. Unpausing it...`,
      );
      await dockerContainer.unpause();
      logStream = await createLogStream({
        dockerContainer,
        containerName,
      });
    } else if (state === "created" || state === "exited") {
      logger.stderr(
        `[StartContainer] Container '${containerName}' exists in state '${existingContainer.State}'. Starting it...`,
      );
      await dockerContainer.start();
      logStream = await createLogStream({
        dockerContainer,
        containerName,
      });
    } else if (state === "running") {
      logger.stderr(
        `[StartContainer] Container '${containerName}' is already running.`,
      );
    } else {
      throw new CommandError(
        `[StartContainer] Container '${containerName}' already exists in state '${state}' and cannot be started.`,
      );
    }
  } else {
    logger.stderr(`[StartContainer] Starting container '${containerName}'...`);
    const dockerContainer = await createContainer({
      imageName,
      containerName,
      hostPort,
      containerPort,
    });
    await dockerContainer.start();
    logStream = await createLogStream({
      dockerContainer,
      containerName,
    });
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
    logStream = await createLogStream({
      dockerContainer,
      containerName,
    });
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
 * @param {number} interval The interval between attempts in milliseconds
 * @param {Object} logStream The log stream to destroy when the container is ready
 * @returns {Promise<void>} a promise that resolves when the container is ready.
 * It will reject if the container is not ready after the maximum number of attempts.
 */
async function waitForHealthCheck({
  url,
  maxAttempts = 100,
  interval = 10000,
  logStream,
}) {
  const logger = container.resolve("logger");
  const fetch = container.resolve("fetch");
  logger.stderr(`[HealthCheck] Waiting for Fauna to be ready at ${url}...`);

  let attemptCounter = 0;
  let errorMessage = "";
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
      errorMessage = `with HTTP status: '${response.status}'`;
    } catch (e) {
      errorMessage = `with error: ${e.message}`;
    }
    logger.stderr(
      `[HealthCheck] Fauna is not yet ready. Attempt ${attemptCounter + 1}/${maxAttempts} failed ${errorMessage}. Retrying in ${interval / 1000} seconds...`,
    );
    attemptCounter++;
    /* eslint-disable-next-line no-await-in-loop */
    await new Promise((resolve) => {
      setTimeout(resolve, interval);
    });
  }

  logger.stderr(
    `[HealthCheck] Max attempts reached. Service at ${url} did not respond.`,
  );
  throw new CommandError(
    `[HealthCheck] Fauna at ${url} is not ready after ${maxAttempts} attempts. Consider increasing --interval or --maxAttempts.`,
  );
}

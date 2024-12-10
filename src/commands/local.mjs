import Docker from "dockerode";

import { container } from "../cli.mjs";

const DOCKER = new Docker();

// Helper function to pull the latest image

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

// Helper function to check if a container exists and its state
async function getContainerState(containerName) {
  const logger = container.resolve("logger"); // Dependency injection for logger
  logger.stderr(
    `[GetContainerState] Checking state for container '${containerName}'...`,
  );
  const containers = await DOCKER.listContainers({ all: true });
  return containers.find((container) =>
    container.Names.includes(`/${containerName}`),
  );
}

// Helper function to start a container
async function startContainer({
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
  await dockerContainer.start();
  return dockerContainer;
}

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

// Main function to ensure the container is running
async function ensureContainerRunning({
  imageName,
  containerName,
  hostPort,
  containerPort,
  pull,
}) {
  const logger = container.resolve("logger");
  try {
    // Optionally pull the latest image
    if (pull) {
      await pullImage(imageName);
    }

    // Check container state
    const existingContainer = await getContainerState(containerName);
    let dockerContainer = undefined;
    if (existingContainer) {
      dockerContainer = DOCKER.getContainer(existingContainer.Id);
      if (existingContainer.State === "paused") {
        logger.stderr(
          `[StartContainer] Container '${containerName}' exists but is paused. Unpausing it...`,
        );
        await dockerContainer.unpause();
      } else if (existingContainer.State === "created") {
        logger.stderr(
          `[StartContainer] Container '${containerName}' is created but not started. Starting it...`,
        );
        await dockerContainer.start();
      } else {
        logger.stderr(
          `[StartContainer] Container '${containerName}' is already running.`,
        );
      }
    } else {
      logger.stderr(
        `[StartContainer] Starting container '${containerName}'...`,
      );
      dockerContainer = await startContainer({
        imageName,
        containerName,
        hostPort,
        containerPort,
      });
    }
    const logStream = await createLogStream({ dockerContainer, containerName });
    // Start a new container
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

async function startLocal(argv) {
  await ensureContainerRunning({
    imageName: argv.image,
    containerName: argv.name,
    hostPort: argv.hostPort,
    containerPort: argv.containerPort,
    pull: argv.pull,
  });
}

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

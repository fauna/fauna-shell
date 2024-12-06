import Docker from "dockerode";

import { container } from "../cli.mjs";

const docker = new Docker();

// Helper function to pull the latest image
async function pullImage(imageName) {
    const logger = container.resolve('logger'); // Dependency injection for logger
    logger.stdout(`Pulling the latest version of ${imageName}...`);

    try {
        const stream = await docker.pull(imageName);
        await new Promise((resolve, reject) => {
          docker.modem.followProgress(stream, (error) => {
            if (error) {
              reject(error);
              return;
            }
            resolve();
            return;
          });
        });
        logger.stdout(`Image ${imageName} pulled successfully.`);
    } catch (error) {
        logger.stderr(`Error pulling image ${imageName}: ${error.message}`);
        throw error;
    }
}


// Helper function to check if a container exists and its state
async function getContainerState(containerName) {
  const logger = container.resolve("logger"); // Dependency injection for logger
  logger.stdout(`Checking state for container '${containerName}'...`);
  const containers = await docker.listContainers({ all: true });
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
  const logger = container.resolve("logger"); // Dependency injection for logger
  logger.stdout(`Starting container '${containerName}'...`);

  const dockerContainer = await docker.createContainer({
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
  logger.stdout(`Container '${containerName}' started successfully.`);
}

// Main function to ensure the container is running
async function ensureContainerRunning({
  imageName,
  containerName,
  hostPort,
  containerPort,
  pull,
}) {
  const logger = container.resolve("logger"); // Dependency injection for logger
  try {
    // Optionally pull the latest image
    if (pull) {
      await pullImage(imageName);
    }

    // Check container state
    const existingContainer = await getContainerState(containerName);
    if (existingContainer) {
      if (existingContainer.State === "running") {
        logger.stdout(
          `Container '${containerName}' is already running. Skipping start.`,
        );
        return;
      } else {
        logger.stdout(
          `Container '${containerName}' exists but is stopped. Starting it...`,
        );
        const container = docker.getContainer(existingContainer.Id);
        await container.start();
        logger.stdout(`Container '${containerName}' started.`);
        return;
      }
    }
    // Start a new container
    await startContainer({ imageName, containerName, hostPort, containerPort });
  } catch (error) {
    logger.stderr(`Error: ${error.message}`);
  }
}

async function waitForHealthCheck(url, maxAttempts = 200, delay = 5000) {
  const logger = container.resolve("logger");
  logger.stdout(`Waiting for service to be ready at ${url}...`);

  let attemptCounter = 0;

  while (attemptCounter < maxAttempts) {
    try {
      const response = await fetch(`${url}/ping`, {
        method: "GET",
        timeout: 1000,
      });
      if (response.ok) {
        logger.stdout(`Service is ready at ${url}`);
        return;
      }
    } catch (error) {
      logger.stdout(
        `Attempt ${attemptCounter + 1}/${maxAttempts} failed: ${error.message}. Retrying in ${delay / 1000} seconds...`,
      );
    }

    attemptCounter++;
    await new Promise((resolve) => {setTimeout(resolve, delay)});
  }

  logger.stderr(`Max attempts reached. Service at ${url} did not respond.`);
  throw new Error(
    `Service at ${url} is not ready after ${maxAttempts} attempts.`,
  );
}

async function startLocal(argv) {
  const logger = container.resolve("logger"); // Dependency injection for logger
  try {
    await ensureContainerRunning({
      imageName: argv.image,
      containerName: argv.name,
      hostPort: argv.hostPort,
      containerPort: argv.containerPort,
      pull: argv.pull,
    });
    await waitForHealthCheck(`http://localhost:${argv.hostPort}`);
  } catch (error) {
    logger.stderr(`Error: ${error.message}`);
  }
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

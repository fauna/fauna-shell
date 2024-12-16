//@ts-check

import { expect } from "chai";
import { AbortError } from "fauna";
import sinon, { stub } from "sinon";

import { run } from "../src/cli.mjs";
import { setupTestContainer } from "../src/config/setup-test-container.mjs";
import { f } from "./helpers.mjs";

describe("ensureContainerRunning", () => {
  let container,
    fetch,
    logger,
    stderrStream,
    docker,
    logsStub,
    serverMock,
    simulateError,
    startStub,
    unpauseStub;

  beforeEach(async () => {
    simulateError = false;
    container = await setupTestContainer();
    logger = container.resolve("logger");
    stderrStream = container.resolve("stderrStream");
    fetch = container.resolve("fetch");
    docker = container.resolve("docker");
    logsStub = stub();
    startStub = stub();
    unpauseStub = stub();
    // Requested port is free
    serverMock = {
      close: sinon.stub(),
      once: sinon.stub(),
      on: sinon.stub(),
      listen: sinon.stub(),
    };
    serverMock.listen.callsFake(() => {
      if (simulateError) {
        // Trigger the error callback
        const errorCallback = serverMock.once.withArgs("error").args[0]?.[1];
        if (errorCallback) {
          /** @type {Error & {code?: string}} */
          const error = new Error("Foo");
          error.code = "EADDRINUSE";
          errorCallback(error);
        }
      } else {
        // Trigger the listening callback
        const listeningCallback =
          serverMock.on.withArgs("listening").args[0]?.[1];
        if (listeningCallback) {
          listeningCallback();
        }
      }
    });

    serverMock.on.withArgs("listening").callsFake((_event, callback) => {
      if (simulateError) {
        // Trigger the error callback
        const errorCallback = serverMock.once.withArgs("error").args[0]?.[1];
        if (errorCallback) {
          /** @type {Error & {code?: string}} */
          const error = new Error("Foo");
          error.code = "EADDRINUSE";
          errorCallback(error);
        }
      } else {
        callback();
      }
    });

    serverMock.close.callsFake((callback) => {
      if (callback) callback();
    });
    const net = container.resolve("net");
    net.createServer.returns(serverMock);
  });

  function setupCreateContainerMocks() {
    docker.pull.onCall(0).resolves();
    docker.modem.followProgress.callsFake((_stream, onFinished) => {
      onFinished();
    });
    docker.listContainers.onCall(0).resolves([]);
    fetch.onCall(0).resolves(f({})); // fast succeed the health check
    logsStub.callsFake(async () => ({
      on: () => {},
      destroy: () => {},
    }));
    docker.createContainer.resolves({
      start: startStub,
      logs: logsStub,
      unpause: unpauseStub,
    });
  }

  it("Shows a clear error to the user if something is already running on the desired port.", async () => {
    simulateError = true;
    docker.pull.onCall(0).resolves();
    docker.modem.followProgress.callsFake((_stream, onFinished) => {
      onFinished();
    });
    docker.listContainers.onCall(0).resolves([]);
    try {
      // Run the actual command
      await run("local --no-color", container);
    } catch (_) {
      // Expected error, no action needed
    }

    const written = stderrStream.getWritten();

    // Assertions
    expect(written).to.contain(
      "[StartContainer] The hostPort '8443' on IP '0.0.0.0' is already occupied. \
Please pass a --host-port other than '8443'.",
    );
    expect(written).not.to.contain("fauna local");
    expect(written).not.to.contain("An unexpected");
  });

  [
    "--database Foo",
    "--database Foo --typechecked --protected --priority 1",
  ].forEach((args) => {
    it("Creates a database if requested", async () => {
      setupCreateContainerMocks();
      const { runQuery } = container.resolve("faunaClientV10");
      runQuery.resolves({
        data: JSON.stringify({ name: "Foo" }, null, 2),
      });
      await run(`local --no-color ${args}`, container);
      expect(runQuery).to.have.been.calledWith({
        secret: "secret",
        url: "http://0.0.0.0:8443",
        query: sinon.match.any,
        options: { format: "decorated" },
      });
      const written = stderrStream.getWritten();
      expect(written).to.contain("[CreateDatabase] Database 'Foo' created.");
      expect(written).to.contain('"name": "Foo"');
    });
  });

  it("Exits with an expected error if the create db query aborts", async () => {
    setupCreateContainerMocks();
    const { runQuery } = container.resolve("faunaClientV10");
    runQuery.rejects(new AbortError({ error: { abort: "Taco" } }));
    try {
      await run(`local --no-color --database Foo`, container);
    } catch (_) {}
    expect(runQuery).to.have.been.calledWith({
      secret: "secret",
      url: "http://0.0.0.0:8443",
      query: sinon.match.any,
      options: { format: "decorated" },
    });
    const written = stderrStream.getWritten();
    expect(written).to.contain("Taco");
    expect(written).not.to.contain("fauna local");
    expect(written).not.to.contain("An unexpected");
  });

  ["--typechecked", "--protected", "--priority 1"].forEach((args) => {
    it("Rejects invalid create database args", async () => {
      setupCreateContainerMocks();
      const { runQuery } = container.resolve("faunaClientV10");
      try {
        await run(`local --no-color ${args}`, container);
      } catch (_) {}
      expect(runQuery).not.to.have.been.called;
      const written = stderrStream.getWritten();
      expect(written).to.contain("fauna local");
      expect(written).not.to.contain("An unexpected");
      expect(written).to.contain("can only be set if");
    });
  });

  it("Does not create a database when not requested to do so", async () => {
    setupCreateContainerMocks();
    const { runQuery } = container.resolve("faunaClientV10");
    await run("local --no-color", container);
    expect(runQuery).not.to.have.been.called;
  });

  it("Creates and starts a container when none exists", async () => {
    setupCreateContainerMocks();
    await run("local --no-color", container);
    expect(unpauseStub).not.to.have.been.called;
    expect(startStub).to.have.been.called;
    expect(logsStub).to.have.been.calledWith({
      stdout: true,
      stderr: true,
      follow: true,
      tail: 100,
    });
    expect(docker.createContainer).to.have.been.calledWith({
      Image: "fauna/faunadb:latest",
      name: "faunadb",
      HostConfig: {
        PortBindings: {
          "8443/tcp": [
            {
              HostPort: "8443",
              HostIp: "0.0.0.0",
            },
          ],
        },
        AutoRemove: true,
      },
      ExposedPorts: {
        "8443/tcp": {},
      },
    });
  });

  it("The user can control the hostIp, hostPort, containerPort, and name", async () => {
    setupCreateContainerMocks();
    await run(
      "local --no-color --hostPort 10 --containerPort 11 --name Taco --hostIp 127.0.0.1",
      container,
    );
    expect(docker.createContainer).to.have.been.calledWith({
      Image: "fauna/faunadb:latest",
      name: "Taco",
      HostConfig: {
        PortBindings: {
          "11/tcp": [
            {
              HostPort: "10",
              HostIp: "127.0.0.1",
            },
          ],
        },
        AutoRemove: true,
      },
      ExposedPorts: {
        "11/tcp": {},
      },
    });
  });

  it("Skips pull if --pull is false.", async () => {
    setupCreateContainerMocks();
    await run("local --no-color --pull false", container);
    expect(docker.pull).not.to.have.been.called;
    expect(docker.modem.followProgress).not.to.have.been.called;
    expect(startStub).to.have.been.called;
    expect(logsStub).to.have.been.called;
    expect(docker.createContainer).to.have.been.called;
    expect(logger.stderr).to.have.been.calledWith(
      "[ContainerReady] Container 'faunadb' is up and healthy.",
    );
  });

  it("Fails start with a prompt to contact Fauna if pull fails.", async () => {
    setupCreateContainerMocks();
    docker.pull.onCall(0).rejects(new Error("Remote repository not found"));
    try {
      await run("local --no-color", container);
    } catch (_) {}
    expect(docker.pull).to.have.been.called;
    expect(docker.modem.followProgress).not.to.have.been.called;
    expect(startStub).not.to.have.been.called;
    expect(logsStub).not.to.have.been.called;
    expect(docker.createContainer).not.to.have.been.called;
    const written = stderrStream.getWritten();
    expect(written).to.contain(
      `[PullImage] Failed to pull image 'fauna/faunadb:latest': Remote repository \
not found. If this issue persists contact support: \
https://support.fauna.com/hc/en-us/requests/new`,
    );
    expect(written).not.to.contain("An unexpected");
    expect(written).not.to.contain("fauna local"); // help text
  });

  it("Throws an error if the health check fails", async () => {
    setupCreateContainerMocks();
    fetch.onCall(0).rejects();
    fetch.resolves(f({}, 503)); // fail from http
    try {
      await run("local --no-color --interval 0 --max-attempts 3", container);
    } catch (_) {}
    const written = stderrStream.getWritten();
    expect(written).to.contain("with HTTP status: '503'");
    expect(written).to.contain("with error:");
    expect(written).to.contain(
      "[HealthCheck] Fauna at http://0.0.0.0:8443 is not ready after 3 attempts. Consider increasing --interval or --max-attempts.",
    );
    expect(written).not.to.contain("An unexpected");
    expect(written).not.to.contain("fauna local"); // help text
  });

  it("exits if a container cannot be started", async () => {
    docker.pull.onCall(0).resolves();
    docker.modem.followProgress.callsFake((_stream, onFinished) => {
      onFinished();
    });
    docker.listContainers.onCall(0).resolves([
      {
        State: "dead",
        Names: ["/faunadb"],
        Ports: [{ PublicPort: 8443 }],
      },
    ]);
    fetch.onCall(0).resolves(f({})); // fast succeed the health check
    logsStub.callsFake(async () => ({
      on: () => {},
      destroy: () => {},
    }));
    docker.getContainer.onCall(0).returns({
      logs: logsStub,
      start: startStub,
      unpause: unpauseStub,
    });
    try {
      await run("local --no-color", container);
    } catch (_) {}
    const written = stderrStream.getWritten();
    expect(written).to.contain(
      "[StartContainer] Container 'faunadb' already exists in state 'dead' and cannot be started.",
    );
    expect(written).not.to.contain("An unexpected");
  });

  it("throws an error if interval is less than 0", async () => {
    try {
      await run("local --no-color --interval -1", container);
    } catch (_) {}
    const written = stderrStream.getWritten();
    expect(written).to.contain(
      "--interval must be greater than or equal to 0.",
    );
    expect(written).to.contain("fauna local"); // help text
    expect(written).not.to.contain("An unexpected");
  });

  it("throws an error if maxAttempts is less than 1", async () => {
    try {
      await run("local --no-color --max-attempts 0", container);
    } catch (_) {}
    const written = stderrStream.getWritten();
    expect(written).to.contain("--max-attempts must be greater than 0.");
    expect(written).to.contain("fauna local"); // help text
    expect(written).not.to.contain("An unexpected");
  });

  [
    {
      state: "paused",
      startMessage: `[StartContainer] Container 'faunadb' exists but is paused. Unpausing it...`,
      expectCalls: () => {
        expect(unpauseStub).to.have.been.called;
        expect(startStub).not.to.have.been.called;
        expect(logsStub).to.have.been.calledWith({
          stdout: true,
          stderr: true,
          follow: true,
          tail: 100,
        });
      },
    },
    {
      state: "created",
      startMessage: `[StartContainer] Container 'faunadb' exists in state 'created'. Starting it...`,
      expectCalls: () => {
        expect(unpauseStub).not.to.have.been.called;
        expect(startStub).to.have.been.called;
        expect(logsStub).to.have.been.calledWith({
          stdout: true,
          stderr: true,
          follow: true,
          tail: 100,
        });
      },
    },
    {
      state: "exited",
      startMessage: `[StartContainer] Container 'faunadb' exists in state 'exited'. Starting it...`,
      expectCalls: () => {
        expect(unpauseStub).not.to.have.been.called;
        expect(startStub).to.have.been.called;
        expect(logsStub).to.have.been.calledWith({
          stdout: true,
          stderr: true,
          follow: true,
          tail: 100,
        });
      },
    },
    {
      state: "running",
      startMessage: "[StartContainer] Container 'faunadb' is already running.",
      expectCalls: () => {
        expect(unpauseStub).not.to.have.been.called;
        expect(startStub).not.to.have.been.called;
        expect(logsStub).not.to.have.been.called;
      },
    },
  ].forEach((test) => {
    it(`Ensures a container in state '${test.state}' becomes running and available.`, async () => {
      docker.pull.onCall(0).resolves();
      docker.modem.followProgress.callsFake((_stream, onFinished) => {
        onFinished();
      });
      docker.listContainers.onCall(0).resolves([
        {
          State: test.state,
          Names: ["/faunadb"],
          Ports: [{ PublicPort: 8443, Type: "tcp" }],
        },
      ]);
      fetch.onCall(0).resolves(f({})); // fast succeed the health check
      logsStub.callsFake(async () => ({
        on: () => {},
        destroy: () => {},
      }));
      docker.getContainer.onCall(0).returns({
        logs: logsStub,
        start: startStub,
        unpause: unpauseStub,
      });
      try {
        await run("local --no-color", container);
      } catch (_) {
        expect(test.state).to.equal("dead");
      }
      expect(docker.pull).to.have.been.calledWith("fauna/faunadb:latest");
      expect(docker.modem.followProgress).to.have.been.calledWith(
        sinon.match.any,
        sinon.match.func,
      );
      expect(docker.listContainers).to.have.been.calledWith({
        all: true,
        filters: JSON.stringify({ name: ["faunadb"] }),
      });
      test.expectCalls();
      expect(logger.stderr).to.have.been.calledWith(test.startMessage);
      expect(logger.stderr).to.have.been.calledWith(
        `[PullImage] Pulling image 'fauna/faunadb:latest'...`,
      );
      expect(logger.stderr).to.have.been.calledWith(
        "[PullImage] Image 'fauna/faunadb:latest' pulled.",
      );
      expect(logger.stderr).to.have.been.calledWith(
        "[StartContainer] Container 'faunadb' started. Monitoring HealthCheck for readiness.",
      );
      expect(logger.stderr).to.have.been.calledWith(
        "[HealthCheck] Waiting for Fauna to be ready at http://0.0.0.0:8443...",
      );
      expect(logger.stderr).to.have.been.calledWith(
        "[HealthCheck] Fauna is ready at http://0.0.0.0:8443",
      );
      expect(logger.stderr).to.have.been.calledWith(
        "[ContainerReady] Container 'faunadb' is up and healthy.",
      );
    });
  });

  it("should throw if container exists with same name but different port", async () => {
    const desiredPort = 8443;
    docker.pull.onCall(0).resolves();
    docker.modem.followProgress.callsFake((_stream, onFinished) => {
      onFinished();
    });
    // Mock existing container with different port
    docker.listContainers.onCall(0).resolves([
      {
        Id: "mock-container-id",
        Names: ["/faunadb"],
        State: "running",
        Ports: [
          { PublicPort: 9999, Type: "tcp" }, // Different port than desired
        ],
      },
    ]);

    try {
      await run(`local --hostPort ${desiredPort}`, container);
    } catch (_) {}
    expect(docker.listContainers).to.have.been.calledWith({
      all: true,
      filters: JSON.stringify({ name: ["faunadb"] }),
    });
    expect(startStub).not.to.have.been.called;
    expect(unpauseStub).not.to.have.been.called;
    expect(logsStub).not.to.have.been.called;
    const written = stderrStream.getWritten();
    expect(written).to.contain(
      `[FindContainer] Container 'faunadb' is already in use on hostPort '9999'. \
Please use a new name via arguments --name <newName> --hostPort ${desiredPort} \
to start the container.`,
    );
    expect(written).not.to.contain("An unexpected");
    expect(written).not.to.contain("fauna local"); // help text
  });
});

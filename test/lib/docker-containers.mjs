//@ts-check

import { expect } from "chai";

import { run } from "../../src/cli.mjs";
import { setupTestContainer } from "../../src/config/setup-test-container.mjs";
import { f } from "../helpers.mjs";
import { stub } from "sinon";

describe("ensureContainerRunning", () => {
  let container, fetch, logger, stderrStream, docker;

  beforeEach(async () => {
    container = await setupTestContainer();
    logger = container.resolve("logger");
    stderrStream = container.resolve("stderrStream");
    fetch = container.resolve("fetch");
    docker = container.resolve("docker");
  });

  it("Should show messaging to the user if the container is already started", async () => {
    docker.pull.onCall(0).resolves();
    docker.modem.followProgress.callsFake((stream, onFinished) => {
      onFinished();
    });
    docker.listContainers
      .onCall(0)
      .resolves([{ State: "running", Names: ["/faunadb"] }]);
    fetch.onCall(0).resolves(f({})); // fast succeed the health check
    await run("local", container);
    expect(logger.stderr).to.have.been.calledWith(
      `[PullImage] Pulling image 'fauna/faunadb:latest'...\n`,
    );
    expect(logger.stderr).to.have.been.calledWith(
      "[PullImage] Image 'fauna/faunadb:latest' pulled.",
    );
    expect(logger.stderr).to.have.been.calledWith(
      "[StartContainer] Container 'faunadb' is already running.",
    );
    expect(logger.stderr).to.have.been.calledWith(
      "[StartContainer] Container 'faunadb' started. Monitoring HealthCheck for readiness.",
    );
    expect(logger.stderr).to.have.been.calledWith(
      "[ContainerReady] Container 'faunadb' is up and healthy.",
    );
  });

  it.only("Should show messaging to the user if the container is restarting. And it should fire up a logger.", async () => {
    docker.pull.onCall(0).resolves();
    docker.modem.followProgress.callsFake((stream, onFinished) => {
      onFinished();
    });
    docker.listContainers
      .onCall(0)
      .resolves([{ State: "restarting", Names: ["/faunadb"] }]);
    fetch.onCall(0).resolves(f({})); // fast succeed the health check
    const logsStub = stub();
    docker.getContainer.onCall(0).resolves({
      logs: logsStub,
    });
    await run("local", container);
    expect(logger.stderr).to.have.been.calledWith(
      `[PullImage] Pulling image 'fauna/faunadb:latest'...\n`,
    );
    expect(logger.stderr).to.have.been.calledWith(
      "[PullImage] Image 'fauna/faunadb:latest' pulled.",
    );
    expect(logger.stderr).to.have.been.calledWith(
      "[StartContainer] Container 'faunadb' is restarting.",
    );
    expect(logger.stderr).to.have.been.calledWith(
      "[StartContainer] Container 'faunadb' started. Monitoring HealthCheck for readiness.",
    );
    expect(logger.stderr).to.have.been.calledWith(
      "[ContainerReady] Container 'faunadb' is up and healthy.",
    );
    expect(logsStub).to.have.been.calledWith({
      stdout: true,
      stderr: true,
      follow: true,
      tail: 100,
    });
  });
});

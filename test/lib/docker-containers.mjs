//@ts-check

import { expect } from "chai";

import { run } from "../../src/cli.mjs";
import { setupTestContainer } from "../../src/config/setup-test-container.mjs";
import { f } from "../helpers.mjs";

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
    console.log("running");
    await run("local", container);
    console.log("done running");
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
});

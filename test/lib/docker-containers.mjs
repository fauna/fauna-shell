//@ts-check

import { expect } from "chai";

import { run } from "../../src/cli.mjs";
import { setupTestContainer } from "../../src/config/setup-test-container.mjs";
import { f } from "../helpers.mjs";
import sinon, { stub } from "sinon";

describe.only("ensureContainerRunning", () => {
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
    const logsStub = stub();
    const startStub = stub();
    docker.getContainer.onCall(0).returns({
      logs: logsStub,
      start: startStub,
    });
    await run("local", container);
    expect(docker.pull).to.have.been.calledWith("fauna/faunadb:latest");
    expect(docker.modem.followProgress).to.have.been.calledWith(sinon.matchAny, sinon.match.func);
    expect(docker.listContainers).to.have.been.calledWith({ all: true });
    expect(startStub).to.not.have.been.called;
    expect(logsStub).to.not.have.been.called;
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

  it("Should show messaging to the user if the container is restarting. And it should fire up a logger.", async () => {
    docker.pull.onCall(0).resolves();
    docker.modem.followProgress.callsFake((stream, onFinished) => {
      onFinished();
    });
    docker.listContainers
      .onCall(0)
      .resolves([{ State: "restarting", Names: ["/faunadb"] }]);
    fetch.onCall(0).resolves(f({})); // fast succeed the health check
    const logsStub = stub();
    const startStub = stub();
    logsStub.callsFake(async () => ({
      on: () => {},
      destroy: () => {},
    }));
    docker.getContainer.onCall(0).returns({
      logs: logsStub,
      start: startStub,
    });
    await run("local", container);
    expect(logsStub).to.have.been.calledWith({
      stdout: true,
      stderr: true,
      follow: true,
      tail: 100,
    });
    expect(startStub).to.not.have.been.called;
    expect(logger.stderr).to.have.been.calledWith(
      "[StartContainer] Container 'faunadb' is restarting.",
    );
  });

  [
    "created",
    "exited",
  ].forEach((state) => {
    it(`Starts the container when it already exists in state '${state}'`, async () => {
      docker.pull.onCall(0).resolves();
      docker.modem.followProgress.callsFake((stream, onFinished) => {
        onFinished();
      });
      docker.listContainers
        .onCall(0)
        .resolves([{ State: state, Names: ["/faunadb"] }]);
      fetch.onCall(0).resolves(f({})); // fast succeed the health check
      const logsStub = stub();
      const startStub = stub();
      logsStub.callsFake(async () => ({
        on: () => {},
        destroy: () => {},
      }));
      docker.getContainer.onCall(0).returns({
        logs: logsStub,
        start: startStub,
      });
      await run("local", container);
      expect(logsStub).to.have.been.calledWith({
        stdout: true,
        stderr: true,
        follow: true,
        tail: 100,
      });
      expect(startStub).to.have.been.called;
      expect(logger.stderr).to.have.been.calledWith(
        `[StartContainer] Container 'faunadb' exists in state '${state}'. Starting it ...`,
      );
    });
  });

  it("Unpauses the container when it is in state 'paused'", async () => {
    docker.pull.onCall(0).resolves();
    docker.modem.followProgress.callsFake((stream, onFinished) => {
      onFinished();
    });
    docker.listContainers
      .onCall(0)
      .resolves([{ State: "paused", Names: ["/faunadb"] }]);
    fetch.onCall(0).resolves(f({})); // fast succeed the health check
    const logsStub = stub();
    const startStub = stub();
    const pausedStub = stub();
    logsStub.callsFake(async () => ({
      on: () => {},
      destroy: () => {},
    }));
    docker.getContainer.onCall(0).returns({
      logs: logsStub,
      start: startStub,
      paused: pausedStub
    });
    await run("local", container);
    expect(logsStub).to.have.been.calledWith({
      stdout: true,
      stderr: true,
      follow: true,
      tail: 100,
    });
    expect(startStub).to.have.been.called;
    expect(logger.stderr).to.have.been.calledWith(
      `[StartContainer] Container 'faunadb' exists in state '${state}'. Starting it ...`,
    );
  });
});

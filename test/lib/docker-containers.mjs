//@ts-check

import { expect } from "chai";

import { run } from "../../src/cli.mjs";
import { setupTestContainer } from "../../src/config/setup-test-container.mjs";
import { f } from "../helpers.mjs";
import sinon, { stub } from "sinon";

describe.only("ensureContainerRunning", () => {
  let container, fetch, logger, stderrStream, docker, logsStub, startStub, unpauseStub;

  beforeEach(async () => {
    container = await setupTestContainer();
    logger = container.resolve("logger");
    stderrStream = container.resolve("stderrStream");
    fetch = container.resolve("fetch");
    docker = container.resolve("docker");
    logsStub = stub();
    startStub = stub();
    unpauseStub = stub();
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
      state: "restarting",
      startMessage: `[StartContainer] Container 'faunadb' is restarting.`,
      expectCalls: () => {
        expect(unpauseStub).not.to.have.been.called;
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
      state: "running",
      startMessage: "[StartContainer] Container 'faunadb' is already running.",
      expectCalls: () => {
        expect(unpauseStub).not.to.have.been.called;
        expect(startStub).not.to.have.been.called;
        expect(logsStub).not.to.have.been.called;
      },
    }
  ].forEach((test) => {
    it(`Ensures a container in state '${test.state}' becomes running and available.`, async () => {
      docker.pull.onCall(0).resolves();
      docker.modem.followProgress.callsFake((stream, onFinished) => {
        onFinished();
      });
      docker.listContainers
        .onCall(0)
        .resolves([{ State: test.state, Names: ["/faunadb"] }]);
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
      await run("local", container);
      expect(docker.pull).to.have.been.calledWith("fauna/faunadb:latest");
      expect(docker.modem.followProgress).to.have.been.calledWith(sinon.matchAny, sinon.match.func);
      expect(docker.listContainers).to.have.been.calledWith({ all: true });
      test.expectCalls();
      expect(logger.stderr).to.have.been.calledWith(test.startMessage);
      expect(logger.stderr).to.have.been.calledWith(
        `[PullImage] Pulling image 'fauna/faunadb:latest'...\n`,
      );
      expect(logger.stderr).to.have.been.calledWith(
        "[PullImage] Image 'fauna/faunadb:latest' pulled.",
      );
      expect(logger.stderr).to.have.been.calledWith(
        "[StartContainer] Container 'faunadb' started. Monitoring HealthCheck for readiness.",
      );
      expect(logger.stderr).to.have.been.calledWith(
        "[HealthCheck] Waiting for Fauna to be ready at http://localhost:8443...",
      );
      expect(logger.stderr).to.have.been.calledWith(
        "[HealthCheck] Fauna is ready at http://localhost:8443",
      );
      expect(logger.stderr).to.have.been.calledWith(
        "[ContainerReady] Container 'faunadb' is up and healthy.",
      );
    });
  });
});

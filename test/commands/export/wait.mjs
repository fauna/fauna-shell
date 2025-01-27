import { expect } from "chai";
import sinon from "sinon";

import {
  waitAndCheckExportState,
  waitUntilExportIsReady,
} from "../../../src/commands/export/wait.mjs";
import { setContainer } from "../../../src/config/container.mjs";
import { setupTestContainer as setupContainer } from "../../../src/config/setup-test-container.mjs";
import { ExportState } from "../../../src/lib/account-api.mjs";
import { CommandError } from "../../../src/lib/errors.mjs";

describe("export wait helpers", () => {
  let container, getExport, sleep;

  beforeEach(() => {
    container = setupContainer();
    sleep = container.resolve("sleep");
    ({ getExport } = container.resolve("accountAPI"));

    setContainer(container);
  });

  describe("waitUntilExportIsReady", () => {
    it("should return export data when export completes successfully", async () => {
      const exportId = "test-export-id";
      const exportData = { id: exportId, is_terminal: true, state: ExportState.Complete };
      const statusHandler = sinon.stub();

      getExport.resolves(exportData);

      const result = await waitUntilExportIsReady({
        id: exportId,
        opts: { quiet: false, color: false, statusHandler },
      });

      expect(getExport).to.have.been.calledWith({ exportId });
      expect(result).to.deep.equal(exportData);
      expect(sleep.calledOnce).to.be.true;
      expect(statusHandler).to.have.been.calledWith(
        `test-export-id is Pending and not yet started.`,
      );
      expect(statusHandler).to.have.been.calledWith(
        "test-export-id has a terminal state of Complete.",
      );
    });

    it("should not print status when quiet is true", async () => {
      const exportId = "test-export-id";
      const exportData = { id: exportId, is_terminal: true };
      const statusHandler = sinon.stub();

      getExport.resolves(exportData);

      const result = await waitUntilExportIsReady({
        id: exportId,
        opts: { quiet: true, color: false, statusHandler },
      });

      expect(getExport).to.have.been.calledWith({ exportId });
      expect(result).to.deep.equal(exportData);
      expect(sleep.calledOnce).to.be.true;
      expect(statusHandler).to.have.not.been.called;
    });

    it("should respect maxWait parameter", async () => {
      const exportId = "test-export-id";

      // Force timeout by setting maxWait to 0
      try {
        await waitUntilExportIsReady({
          id: exportId,
          opts: { maxWait: 0, quiet: true },
        });
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).to.be.instanceOf(CommandError);
        expect(error.message).to.include(
          "did not complete within the allotted time",
        );
      }
    });
  });

  describe("waitAndCheckExportState", () => {
    it("should retry until export reaches terminal state", async () => {
      const exportId = "test-export-id";
      const exitAt = Date.now() + 5000;

      getExport
        .onFirstCall()
        .resolves({ id: exportId, is_terminal: false, state: ExportState.Pending })
        .onSecondCall()
        .resolves({ id: exportId, is_terminal: true, state: ExportState.Complete });

      const result = await waitAndCheckExportState({
        id: exportId,
        exitAt,
        color: false,
        statusHandler: () => {},
      });

      expect(result.state).to.equal(ExportState.Complete);
      expect(getExport.calledTwice).to.be.true;
      expect(sleep.calledTwice).to.be.true;
    });

    it("should throw error when timeout is reached", async () => {
      const exportId = "test-export-id";
      const exitAt = Date.now() - 1000; // Already expired

      try {
        await waitAndCheckExportState({
          id: exportId,
          exitAt,
          color: false,
          statusHandler: () => {},
        });
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).to.be.instanceOf(CommandError);
        expect(error.message).to.include(
          "did not complete within the allotted time",
        );
      }
    });

    it("should respect interval backoff with maximum limit", async () => {
      const exportId = "test-export-id";
      const exitAt = Date.now() + 10000;

      getExport
        .onFirstCall()
        .resolves({ id: exportId, is_terminal: false })
        .onSecondCall()
        .resolves({ id: exportId, is_terminal: false })
        .onThirdCall()
        .resolves({ id: exportId, is_terminal: true });

      await waitAndCheckExportState({
        id: exportId,
        exitAt,
        interval: 1000,
        color: false,
        statusHandler: () => {},
      });

      expect(sleep.firstCall.args[0]).to.equal(1000);
      expect(sleep.secondCall.args[0]).to.equal(2000);
    });
  });
});

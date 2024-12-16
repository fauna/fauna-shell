//@ts-check

import { expect } from "chai";
import chalk from "chalk";
import sinon from "sinon";

import { builtYargs, run } from "../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../src/config/setup-test-container.mjs";
import {
  AUTHENTICATION_ERROR_MESSAGE,
  NETWORK_ERROR_MESSAGE,
} from "../../src/lib/errors.mjs";

describe("schema", function () {
  let container, logger, stderr;
  beforeEach(() => {
    container = setupContainer();
    logger = container.resolve("logger");
    stderr = container.resolve("stderrStream");
  });

  [
    { command: "schema status" },
    { command: "schema push" },
    { command: "schema abandon" },
    { command: "schema diff" },
    { command: "schema pull" },
    { command: "schema commit" },
  ].forEach(({ command }) => {
    it(`requires a database or secret to call: ${command}`, async function () {
      try {
        await run(command, container);
      } catch (e) {}

      expect(logger.stderr).to.have.been.calledWith(
        `${chalk.reset(await builtYargs.getHelp())}\n\n${chalk.red("No database or secret specified. Please use either --database, --secret, or --local to connect to your desired Fauna database.")}`,
      );
      expect(container.resolve("parseYargs")).to.have.been.calledOnce;
    });

    it("can handle network errors", async function () {
      container.resolve("fetch").rejects(new TypeError("fetch failed"));
      container.resolve("gatherFSL").resolves([
        {
          name: "test.fsl",
          content: "collection Test { name: String }",
        },
      ]);

      try {
        await run(`${command} --secret=test-secret --dir=test-dir`, container);
      } catch (e) {}

      await stderr.waitForWritten();

      expect(stderr.getWritten()).to.contain(NETWORK_ERROR_MESSAGE);
      expect(stderr.getWritten()).to.not.contain("unexpected error");
    });

    it("can handle unauthorized errors", async function () {
      container.resolve("fetch").resolves({
        status: 401,
        json: () => Promise.resolve({ error: { code: "unauthorized" } }),
      });

      container.resolve("gatherFSL").resolves([
        {
          name: "test.fsl",
          content: "collection Test { name: String }",
        },
      ]);

      try {
        await run(`${command} --secret=test-secret`, container);
      } catch (e) {}

      expect(logger.stderr).to.have.been.calledWith(
        sinon.match(AUTHENTICATION_ERROR_MESSAGE),
      );
      expect(stderr.getWritten()).to.not.contain("unexpected error");
    });
  });
});

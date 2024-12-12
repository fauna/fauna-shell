//@ts-check

import { expect } from "chai";
import chalk from "chalk";

import { builtYargs, run } from "../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../src/config/setup-test-container.mjs";
import { NETWORK_ERROR_MESSAGE } from "../../src/lib/errors.mjs";

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
      // Schema push requires fsl locally...we need to accommodate for that, but for now, we'll just skip it
      if (command === "schema push") {
        return;
      }
      container.resolve("fetch").rejects(new TypeError("fetch failed"));

      try {
        await run(`${command} --secret=test-secret --dir=test-dir`, container);
      } catch (e) {}

      await stderr.waitForWritten();

      expect(stderr.getWritten()).to.contain(NETWORK_ERROR_MESSAGE);
    });
  });
});

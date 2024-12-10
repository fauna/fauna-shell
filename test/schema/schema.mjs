//@ts-check

import { expect } from "chai";
import chalk from "chalk";

import { builtYargs, run } from "../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../src/config/setup-test-container.mjs";

describe("schema", function () {
  let container, logger;
  beforeEach(() => {
    container = setupContainer();
    logger = container.resolve("logger");
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
  });
});

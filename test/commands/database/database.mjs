// @ts-check

import { expect } from "chai";
import chalk from "chalk";

import { builtYargs, run } from "../../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../../src/config/setup-test-container.mjs";

describe("database", () => {
  let container, logger;

  beforeEach(() => {
    // reset the container before each test
    container = setupContainer();
    logger = container.resolve("logger");
  });

  [
    {
      command:
        "database create --name 'name' --secret 'secret' --database 'database'",
      message:
        "Cannot use both the '--secret' and '--database' options together. Please specify only one.",
    },
    {
      command:
        "database delete --name 'name' --secret 'secret' --database 'database'",
      message:
        "Cannot use both the '--secret' and '--database' options together. Please specify only one.",
    },
    {
      command: "database list --secret 'secret' --database 'database'",
      message:
        "Cannot use both the '--secret' and '--database' options together. Please specify only one.",
    },
  ].forEach(({ message, command }) => {
    it(`requires a ${message}`, async () => {
      try {
        await run(command, container);
      } catch (e) {}

      expect(logger.stderr).to.have.been.calledWith(
        `${chalk.reset(await builtYargs.getHelp())}\n\n${chalk.red(message)}`,
      );
      expect(container.resolve("parseYargs")).to.have.been.calledOnce;
    });
  });
});

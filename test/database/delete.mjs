//@ts-check

import chalk from "chalk";
import sinon from "sinon";
import { expect } from "chai";
import * as awilix from "awilix";
import { fql, ServiceError } from "fauna";
import { builtYargs, run } from "../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../src/config/setup-test-container.mjs";

describe("database delete", () => {
  let container, logger, runV10Query;

  beforeEach(() => {
    // reset the container before each test
    container = setupContainer();
    logger = container.resolve("logger");
    runV10Query = container.resolve("runV10Query");
  });

  [
    { missing: "name", command: "database delete --secret 'secret'" },
    { missing: "secret", command: "database delete --name 'name'" },
  ].forEach(({ missing, command }) => {
    it(`requires a ${missing}`, async () => {
      try {
        await run(command, container);
      } catch (e) {}

      const message = `${chalk.reset(await builtYargs.getHelp())}\n\n${chalk.red(
        `Missing required argument: ${missing}`,
      )}`;
      expect(logger.stderr).to.have.been.calledWith(message);
      expect(container.resolve("parseYargs")).to.have.been.calledOnce;
    });
  });

  [
    {
      args: "--name 'testdb' --secret 'secret'",
      expected: { name: "testdb", secret: "secret" },
    },
  ].forEach(({ args, expected }) => {
    describe("calls fauna with the user specified arguments", () => {
      it(`${args}`, async () => {
        await run(`database create ${args}`, container);
        expect(runV10Query).to.have.been.calledOnceWith({
          url: sinon.match.string,
          secret: expected.secret,
          query: fql`Database.byName(${expected.name}).delete()`,
        });
      });
    });
  });

  [
    {
      error: new ServiceError({
        error: { code: "unauthorized", message: "whatever" },
      }),
      expectedMessage:
        "Authentication failed: Please either log in using 'fauna login' or provide a valid database secret with '--secret'.",
    },
    {
      error: new ServiceError({
        error: { code: "document_not_found", message: "whatever" },
      }),
      expectedMessage:
        "Not found: Database 'testdb' not found. Please check the database name and try again.",
    },
  ].forEach(({ error, expectedMessage }) => {
    it(`handles ${error.code} errors when calling fauna`, async () => {
      const runV10QueryStub = sinon.stub().rejects(error);
      container.register({
        runV10Query: awilix.asValue(runV10QueryStub),
      });

      try {
        await run(
          `database delete --name 'testdb' --secret 'secret'`,
          container,
        );
      } catch (e) {}

      const message = `${chalk.reset(await builtYargs.getHelp())}\n\n${chalk.red(expectedMessage)}`;
      expect(logger.stderr).to.have.been.calledWith(message);
    });
  });
});

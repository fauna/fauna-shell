//@ts-check

import { expect } from "chai";
import chalk from "chalk";
import * as awilix from "awilix";
import { fql, ServiceError } from "fauna";
import sinon from "sinon";

import { builtYargs, run } from "../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../src/config/setup-test-container.mjs";

describe("database create", () => {
  let container, logger, runV10Query;

  beforeEach(() => {
    // reset the container before each test
    container = setupContainer();
    logger = container.resolve("logger");
    runV10Query = container.resolve("runV10Query");
  });

  [
    { missing: "name", command: "database create --secret 'secret'" },
    { missing: "secret", command: "database create --name 'name'" },
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
    {
      args: "--name 'testdb' --secret 'secret' --typechecked",
      expected: { name: "testdb", secret: "secret", typechecked: true },
    },
    {
      args: "--name 'testdb' --secret 'secret' --protected",
      expected: { name: "testdb", secret: "secret", protected: true },
    },
    {
      args: "--name 'testdb' --secret 'secret' --priority 10",
      expected: { name: "testdb", secret: "secret", priority: 10 },
    },
  ].forEach(({ args, expected }) => {
    it(`calls runV10Query with correct arguments: ${args}`, async () => {
      await run(`database create ${args}`, container);
      expect(runV10Query).to.have.been.calledOnceWith({
        url: sinon.match.string,
        secret: expected.secret,
        query: fql`Database.create({
          name: ${expected.name},
          protected: ${expected.protected ?? null},
          typechecked: ${expected.typechecked ?? null},
          priority: ${expected.priority ?? null},
        })`,
      });
    });
  });

  [
    {
      error: new ServiceError({
        error: { code: "constraint_failure", message: "whatever" },
      }),
      expectedMessage:
        "Constraint failure: The database 'testdb' may already exists or one of the provided options may be invalid.",
    },
    {
      error: new ServiceError({
        error: { code: "unauthorized", message: "whatever" },
      }),
      expectedMessage:
        "Authentication failed: Please either log in using 'fauna login' or provide a valid database secret with '--secret'",
    },
  ].forEach(({ error, expectedMessage }) => {
    it(`handles fauna errors: ${error.code}`, async () => {
      const runV10QueryStub = sinon.stub().rejects(error);
      container.register({
        runV10Query: awilix.asValue(runV10QueryStub),
      });

      try {
        await run(
          `database create --name 'testdb' --secret 'secret'`,
          container,
        );
      } catch (e) {}

      const message = `${chalk.reset(await builtYargs.getHelp())}\n\n${chalk.red(expectedMessage)}`;
      expect(logger.stderr).to.have.been.calledWith(message);
    });
  });
});

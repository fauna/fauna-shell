//@ts-check

import { expect } from "chai";
import { fql, ServiceError } from "fauna";
import sinon from "sinon";

import { run } from "../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../src/config/setup-test-container.mjs";

describe("database create", () => {
  let container, logger, runQuery;

  beforeEach(() => {
    // reset the container before each test
    container = setupContainer();
    logger = container.resolve("logger");
    runQuery = container.resolve("faunaClientV10").runQuery;
  });

  [{ missing: "name", command: "database create --secret 'secret'" }].forEach(
    ({ missing, command }) => {
      it(`requires a ${missing}`, async () => {
        try {
          await run(command, container);
        } catch (e) {}

        expect(logger.stderr).to.have.been.calledWith(
          sinon.match(`Missing required argument: ${missing}`),
        );
        expect(container.resolve("parseYargs")).to.have.been.calledOnce;
      });
    },
  );

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
    describe("calls fauna with the user specified arguments", () => {
      it(`${args}`, async () => {
        await run(`database create ${args}`, container);
        expect(runQuery).to.have.been.calledOnceWith({
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
        "Authentication failed: Please either log in using 'fauna login' or provide a valid database secret with '--secret'.",
    },
  ].forEach(({ error, expectedMessage }) => {
    it(`handles ${error.code} errors when calling fauna`, async () => {
      runQuery.rejects(error);

      try {
        await run(
          `database create --name 'testdb' --secret 'secret' --verbosity=9001`,
          container,
        );
      } catch (e) {}

      expect(logger.stderr).to.have.been.calledWith(
        sinon.match(expectedMessage),
      );
    });
  });
});

//@ts-check

import { expect } from "chai";
import { fql, ServiceError } from "fauna";
import sinon from "sinon";

import { run } from "../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../src/config/setup-test-container.mjs";

describe("database delete", () => {
  let container, logger, runQuery;

  beforeEach(() => {
    // reset the container before each test
    container = setupContainer();
    logger = container.resolve("logger");
    runQuery = container.resolve("faunaClientV10").runQuery;
  });

  [{ missing: "name", command: "database delete --secret 'secret'" }].forEach(
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
  ].forEach(({ args, expected }) => {
    describe("calls fauna with the user specified arguments", () => {
      it(`${args}`, async () => {
        await run(`database create ${args}`, container);
        expect(runQuery).to.have.been.calledOnceWith({
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
      runQuery.rejects(error);

      try {
        await run(
          `database delete --name 'testdb' --secret 'secret'`,
          container,
        );
      } catch (e) {}

      expect(logger.stderr).to.have.been.calledWith(
        sinon.match(expectedMessage),
      );
    });
  });
});

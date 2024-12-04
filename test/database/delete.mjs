//@ts-check

import { expect } from "chai";
import chalk from "chalk";
import { fql, ServiceError } from "fauna";
import sinon from "sinon";

import { builtYargs, run } from "../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../src/config/setup-test-container.mjs";
import { mockAccessKeysFile } from "../helpers.mjs";

describe("database delete", () => {
  let container, logger, runQuery, makeAccountRequest;

  beforeEach(() => {
    // reset the container before each test
    container = setupContainer();
    logger = container.resolve("logger");
    runQuery = container.resolve("faunaClientV10").runQuery;
    makeAccountRequest = container.resolve("makeAccountRequest");
  });

  [{ missing: "name", command: "database delete --secret 'secret'" }].forEach(
    ({ missing, command }) => {
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
    },
  );

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

  describe("if --secret is provided", () => {
    [
      {
        args: "--name 'testdb' --secret 'secret'",
        expected: { name: "testdb", secret: "secret" },
      },
    ].forEach(({ args, expected }) => {
      it(`calls fauna with the correct args: ${args}`, async () => {
        await run(`database delete ${args}`, container);

        expect(runQuery).to.have.been.calledOnceWith({
          url: sinon.match.string,
          secret: expected.secret,
          query: fql`Database.byName(${expected.name}).delete()`,
        });

        // If we are using a user provided secret, we should not
        // need to call the account api to mint or refresh a key.
        expect(makeAccountRequest).to.not.have.been.called;
      });
    });
  });

  describe("if --database is provided", () => {
    [
      {
        args: "--name 'testdb' --database 'us-std/example'",
        expected: { name: "testdb", database: "us-std/example" },
      },
    ].forEach(({ args, expected }) => {
      it(`calls fauna with the correct args: ${args}`, async () => {
        mockAccessKeysFile({ fs: container.resolve("fs") });
        // We will attempt to mint a new database key, mock the response
        // so we can verify that the new key is used.
        makeAccountRequest.resolves({ secret: "new-secret" });

        await run(`database delete ${args}`, container);

        // Verify that we made a request to mint a new database key.
        expect(makeAccountRequest).to.have.been.calledOnceWith({
          method: "POST",
          path: "/databases/keys",
          body: sinon.match((value) => value.includes(expected.database)),
          secret: sinon.match.string,
        });

        // Verify that we made a request to delete the database with the new key.
        expect(runQuery).to.have.been.calledOnceWith({
          secret: "new-secret",
          url: sinon.match.string,
          query: fql`Database.byName(${expected.name}).delete()`,
        });
      });
    });
  });
});

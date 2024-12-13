//@ts-check

import { expect } from "chai";
import { fql, ServiceError } from "fauna";
import sinon from "sinon";

import { run } from "../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../src/config/setup-test-container.mjs";
import { AUTHENTICATION_ERROR_MESSAGE } from "../../src/lib/errors.mjs";
import { mockAccessKeysFile } from "../helpers.mjs";

describe("database create", () => {
  let container, logger, runQuery, makeAccountRequest;

  beforeEach(() => {
    // reset the container before each test
    container = setupContainer();
    logger = container.resolve("logger");
    runQuery = container.resolve("faunaClientV10").runQuery;
    makeAccountRequest = container.resolve("makeAccountRequest");
  });

  [
    {
      command: "database create --secret 'secret'",
      message: "Missing required argument: name",
    },
    {
      command: "database create --database 'us-std/example'",
      message: "Missing required argument: name",
    },
    {
      command: "database create --name 'testdb'",
      message:
        "No database or secret specified. Please use either --database, --secret, or --local to connect to your desired Fauna database.",
    },
  ].forEach(({ command, message }) => {
    it(`validates invalid arguments: ${command}`, async () => {
      try {
        await run(command, container);
      } catch (e) {}

      expect(logger.stderr).to.have.been.calledWith(sinon.match(message));
      expect(container.resolve("parseYargs")).to.have.been.calledOnce;
    });
  });

  [
    {
      error: new ServiceError({
        error: { code: "constraint_failure", message: "whatever" },
      }),
      expectedMessage:
        "The database 'testdb' already exists or one of the provided options is invalid.",
    },
    {
      error: new ServiceError({
        error: {
          code: "constraint_failure",
          message: "whatever",
          constraint_failures: [
            {
              paths: [["name"]],
              message: "Invalid identifier.",
            },
          ],
        },
      }),
      expectedMessage:
        "The database name 'testdb' is invalid. Database names must begin with letters and include only letters, numbers, and underscores.",
    },
    {
      error: new ServiceError({
        error: { code: "unauthorized", message: "whatever" },
      }),
      expectedMessage: AUTHENTICATION_ERROR_MESSAGE,
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

  describe("if --secret is provided", () => {
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
      it(`calls fauna with the correct args: ${args}`, async () => {
        await run(`database create ${args}`, container);

        expect(runQuery).to.have.been.calledOnceWith({
          secret: expected.secret,
          url: sinon.match.string,
          query: fql`
            Database.create({
              name: ${expected.name},
              protected: ${expected.protected ?? null},
              typechecked: ${expected.typechecked ?? null},
              priority: ${expected.priority ?? null},
            })
          `,
        });

        // If we are using a user provided secret, we should not
        // need to call the account api to mint or refresh a key.
        expect(makeAccountRequest).to.not.have.been.called;
      });
    });

    it("does not try to refresh the secret if it is invalid", async () => {
      runQuery.rejects(
        new ServiceError(
          {
            error: {
              code: "unauthorized",
              message: "invalid secret",
            },
          },
          401,
        ),
      );

      try {
        await run(
          `database create --name 'testdb' --secret 'secret' --verbosity=9001`,
          container,
        );
      } catch (e) {}

      expect(makeAccountRequest).to.not.have.been.called;
      expect(logger.stderr).to.have.been.calledWith(
        sinon.match(AUTHENTICATION_ERROR_MESSAGE),
      );
    });
  });

  describe("if --database is provided", () => {
    [
      {
        args: "--name 'testdb' --database 'us/example'",
        expected: { name: "testdb", database: "us-std/example" },
      },
      {
        args: "--name 'testdb' --database 'us/example' --typechecked",
        expected: {
          name: "testdb",
          database: "us-std/example",
          typechecked: true,
        },
      },
      {
        args: "--name 'testdb' --database 'us/example' --protected",
        expected: {
          name: "testdb",
          database: "us-std/example",
          protected: true,
        },
      },
      {
        args: "--name 'testdb' --database 'us/example' --priority 10",
        expected: { name: "testdb", database: "us-std/example", priority: 10 },
      },
    ].forEach(({ args, expected }) => {
      it(`calls fauna with the correct args: ${args}`, async () => {
        mockAccessKeysFile({ fs: container.resolve("fs") });
        // We will attempt to mint a new database key, mock the response
        // so we can verify that the new key is used.
        makeAccountRequest.resolves({ secret: "new-secret" });

        await run(`database create ${args}`, container);

        // Verify that we made a request to mint a new database key.
        expect(makeAccountRequest).to.have.been.calledOnceWith({
          method: "POST",
          path: "/databases/keys",
          body: sinon.match((value) => value.includes(expected.database)),
          secret: sinon.match.string,
        });

        // Verify that we made a request to create the database with the new key.
        expect(runQuery).to.have.been.calledOnceWith({
          secret: "new-secret",
          url: sinon.match.string,
          query: fql`
            Database.create({
              name: '${expected.name}',
              protected: ${expected.protected ?? null},
              typechecked: ${expected.typechecked ?? null},
              priority: ${expected.priority ?? null},
            })
          `,
        });
      });
    });
  });
});

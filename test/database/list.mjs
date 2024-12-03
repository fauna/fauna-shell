//@ts-check

import { expect } from "chai";
import { ServiceError } from "fauna";
import sinon from "sinon";

import { run } from "../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../src/config/setup-test-container.mjs";

describe("database list", () => {
  let container, logger, runQueryFromString, formatQueryResponse;

  beforeEach(() => {
    // reset the container before each test
    container = setupContainer();
    logger = container.resolve("logger");
    runQueryFromString = container.resolve("faunaClientV10").runQueryFromString;
    formatQueryResponse =
      container.resolve("faunaClientV10").formatQueryResponse;
  });

  [
    {
      args: "--secret 'secret'",
      expected: { secret: "secret" },
    },
    {
      args: "--secret 'secret' --pageSize 10",
      expected: { secret: "secret", pageSize: 10 },
    },
    {
      args: "--secret 'secret' --json",
      expected: { secret: "secret", json: true },
    },
  ].forEach(({ args, expected }) => {
    it(`calls fauna with ${args}`, async () => {
      const stubedResponse = { data: [{ name: "testdb" }] };
      runQueryFromString.resolves(stubedResponse);

      await run(`database list ${args}`, container);

      expect(runQueryFromString).to.have.been.calledOnceWith({
        url: sinon.match.string,
        secret: expected.secret,
        expression: `Database.all().paginate(${expected.pageSize ?? 1000}).data { name }`,
      });

      expect(logger.stdout).to.have.been.calledOnceWith(
        formatQueryResponse(stubedResponse, {
          json: expected.json ?? false,
        }),
      );
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
  ].forEach(({ error, expectedMessage }) => {
    it(`handles ${error.code} errors when calling fauna`, async () => {
      runQueryFromString.rejects(error);

      try {
        await run(`database list --secret 'secret'`, container);
      } catch (e) {}

      expect(logger.stderr).to.have.been.calledWith(
        sinon.match(expectedMessage),
      );
    });
  });
});

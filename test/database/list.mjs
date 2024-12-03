//@ts-check

import sinon from "sinon";
import { expect } from "chai";
import { ServiceError } from "fauna";
import { run } from "../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../src/config/setup-test-container.mjs";

describe.only("database list", () => {
  let container,
    fs,
    logger,
    runQueryFromString,
    formatQueryResponse,
    makeAccountRequest;

  const mockCredentialsFile = (fs) => {
    const mockedFile =
      '{"default": { "accountKey": "valid-account-key", "refreshToken": "valid-refresh-token"}}';
    fs.readFileSync.withArgs(sinon.match(/access_keys/)).returns(mockedFile);
  };

  beforeEach(() => {
    // reset the container before each test
    container = setupContainer();
    fs = container.resolve("fs");
    logger = container.resolve("logger");
    runQueryFromString = container.resolve("faunaClientV10").runQueryFromString;
    formatQueryResponse =
      container.resolve("faunaClientV10").formatQueryResponse;
    makeAccountRequest = container.resolve("makeAccountRequest");
  });

  describe("when --secret is provided", () => {
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
      it(`calls fauna with the correct args: ${args}`, async () => {
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

        expect(makeAccountRequest).to.not.have.been.called;
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

  describe("when --secret is not provided", () => {
    [
      {
        args: "",
        expected: {},
      },
      {
        args: "--pageSize 10",
        expected: { pageSize: 10 },
      },
      {
        args: "--database 'us-std/example'",
        expected: { database: "us-std/example" },
      },
      {
        args: "--database 'us-std/example' --json",
        expected: { database: "us-std/example", json: true },
      },
    ].forEach(({ args, expected }) => {
      it(`calls the account api with the correct args: ${args}`, async () => {
        mockCredentialsFile(fs);
        const stubbedResponse = { results: [{ name: "test" }] };
        makeAccountRequest.resolves(stubbedResponse);

        await run(`database list ${args}`, container);

        expect(makeAccountRequest).to.have.been.calledOnceWith({
          method: "GET",
          path: "/databases",
          secret: sinon.match.string,
          params: {
            max_results: expected.pageSize ?? 1000,
            ...(expected.database && { path: expected.database }),
          },
        });

        const expectedOutput = stubbedResponse.results.map((d) => ({
          name: d.name,
          // region group is only returned when listing top level databases
          ...(!expected.database && { region_group: sinon.match.any }),
        }));

        expect(logger.stdout).to.have.been.calledOnceWith(
          expected.json ? JSON.stringify(expectedOutput) : expectedOutput,
        );
      });
    });
  });
});

//@ts-check

import { expect } from "chai";
import { ServiceError } from "fauna";
import sinon from "sinon";

import { run } from "../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../src/config/setup-test-container.mjs";
import { AUTHENTICATION_ERROR_MESSAGE } from "../../src/lib/errors.mjs";
import { colorize } from "../../src/lib/formatting/colorize.mjs";
import { mockAccessKeysFile } from "../helpers.mjs";

describe("database list", () => {
  let container, fs, logger, stdout, runQueryFromString, makeAccountRequest;

  beforeEach(() => {
    // reset the container before each test
    container = setupContainer();
    fs = container.resolve("fs");
    logger = container.resolve("logger");
    runQueryFromString = container.resolve("faunaClientV10").runQueryFromString;
    makeAccountRequest = container.resolve("makeAccountRequest");
    stdout = container.resolve("stdoutStream");
  });

  describe("when --local is provided", () => {
    [
      {
        args: "--local",
        expected: { secret: "secret", url: "http://0.0.0.0:8443" },
      },
      {
        args: "--local --url http://yo_dog:8443",
        expected: { secret: "secret", url: "http://yo_dog:8443" },
      },
      {
        args: "--local --secret taco",
        expected: { secret: "taco", url: "http://0.0.0.0:8443" },
      },
      {
        args: "--local --pageSize 10",
        expected: {
          secret: "secret",
          pageSize: 10,
          url: "http://0.0.0.0:8443",
        },
      },
    ].forEach(({ args, expected }) => {
      it(`calls fauna with the correct args: ${args}`, async () => {
        const stubbedResponse = {
          data: [{ name: "testdb" }, { name: "testdb2" }],
        };
        runQueryFromString.resolves(stubbedResponse);

        await run(`database list ${args}`, container);

        expect(runQueryFromString).to.have.been.calledOnceWith({
          url: expected.url,
          secret: expected.secret,
          expression: `Database.all().paginate(${expected.pageSize ?? 1000}).data { name }`,
        });

        await stdout.waitForWritten();

        expect(stdout.getWritten()).to.equal("testdb\ntestdb2\n");
        expect(makeAccountRequest).to.not.have.been.called;
      });
    });
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
    ].forEach(({ args, expected }) => {
      it(`calls fauna with the correct args: ${args}`, async () => {
        const stubbedResponse = { data: [{ name: "testdb" }] };
        runQueryFromString.resolves(stubbedResponse);

        await run(`database list ${args}`, container);

        expect(runQueryFromString).to.have.been.calledOnceWith({
          url: sinon.match.string,
          secret: expected.secret,
          expression: `Database.all().paginate(${expected.pageSize ?? 1000}).data { name }`,
        });

        expect(stdout.getWritten()).to.equal("testdb\n");
        expect(makeAccountRequest).to.not.have.been.called;
      });
    });

    [
      {
        error: new ServiceError({
          error: { code: "unauthorized", message: "whatever" },
        }),
        expectedMessage: AUTHENTICATION_ERROR_MESSAGE,
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
        expected: { regionGroup: "us-std" },
      },
      {
        args: "--pageSize 10",
        expected: { pageSize: 10, regionGroup: "us-std" },
      },
      {
        args: "--database 'us/example'",
        expected: { database: "us-std/example" },
      },
    ].forEach(({ args, expected }) => {
      it(`calls the account api with the correct args: ${args}`, async () => {
        mockAccessKeysFile({ fs });
        const stubbedResponse = {
          results: [
            {
              name: "test",
              ...(expected.regionGroup
                ? { region_group: expected.regionGroup }
                : {}),
              path: expected.regionGroup
                ? `${expected.regionGroup}/test`
                : `${expected.database}/test`,
            },
          ],
        };
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

        expect(stdout.getWritten()).to.equal(
          `${stubbedResponse.results.map((d) => d.path).join("\n")}\n`,
        );
      });
    });
  });

  describe("when --json is provided", () => {
    [
      "--local",
      "--secret=test-secret",
      "--database=us/example",
      "--pageSize 10",
    ].forEach((args) => {
      it(`outputs json when using ${args}`, async () => {
        mockAccessKeysFile({ fs });

        let data;
        if (args.includes("--local") || args.includes("--secret")) {
          data = [{ name: "testdb" }];
          runQueryFromString.resolves({ data });
        } else {
          data = [
            {
              path: "us-std/test",
              name: "test",
            },
          ];
          makeAccountRequest.resolves({
            results: data,
          });
        }

        await run(`database list ${args} --json`, container);
        await stdout.waitForWritten();

        expect(stdout.getWritten().trim()).to.equal(
          `${colorize(data, { format: "json" })}`,
        );
      });
    });
  });
});

//@ts-check

import { expect } from "chai";
import { NetworkError, ServiceError } from "fauna";
import sinon from "sinon";

import { run } from "../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../src/config/setup-test-container.mjs";
import { QUERY_INFO_CHOICES } from "../src/lib/command-helpers.mjs";
import { NETWORK_ERROR_MESSAGE } from "../src/lib/errors.mjs";
import { colorize } from "../src/lib/formatting/colorize.mjs";
import {
  createV4QueryFailure,
  createV4QuerySuccess,
  createV10QueryFailure,
  createV10QuerySuccess,
} from "./helpers.mjs";

describe("query", function () {
  let container, formatQueryInfo, logger, runQueryFromString;

  beforeEach(() => {
    container = setupContainer();
    logger = container.resolve("logger");

    const faunaClient = container.resolve("faunaClient");
    runQueryFromString = faunaClient.runQueryFromString;
    formatQueryInfo = faunaClient.formatQueryInfo;

    // Set a default empty response for all queries
    runQueryFromString.resolves({ data: "test" });
  });

  describe("common", function () {
    it("requires --input or [fql]", async function () {
      try {
        await run(`query --secret=foo`, container);
      } catch (e) {}

      expect(logger.stderr).to.have.been.calledWith(
        sinon.match("No query specified. Pass [fql] or --input."),
      );
    });

    it("does not allow both --input and [fql]", async function () {
      try {
        await run(
          `query --secret=foo --input "test.fql" "Database.all()"`,
          container,
        );
      } catch (e) {}

      expect(logger.stderr).to.have.been.calledWith(
        sinon.match("Cannot specify both --input and [fql]"),
      );
    });

    it("requires a file passed to --input to exist", async function () {
      try {
        await run(`query --secret=foo --input "nonexistent.fql"`, container);
      } catch (e) {}

      expect(logger.stderr).to.have.been.calledWith(
        sinon.match("File passed to --input does not exist: nonexistent.fql"),
      );
    });

    it("requires write access to the directory passed to --output", async function () {
      container.resolve("fs").accessSync.throws(new Error("EACCES"));
      container.resolve("dirname").returns("/var/nonexistent");

      try {
        await run(
          `query --secret=foo --output "/var/nonexistent/result.json" "Database.all()"`,
          container,
        );
      } catch (e) {}

      expect(logger.stderr).to.have.been.calledWith(
        sinon.match("Unable to write to output directory: /var/nonexistent"),
      );
    });

    it("can read from stdin if - is provided", async function () {
      const { readFileSync } = container.resolve("fs");
      readFileSync.returns("Database.all()");

      await run(`query - --secret=foo`, container);

      expect(readFileSync).to.have.been.calledWith(process.stdin.fd, "utf8");
      expect(runQueryFromString).to.have.been.calledWith("Database.all()");
    });

    it("can read input from a file", async function () {
      const { readFileSync, existsSync } = container.resolve("fs");
      readFileSync.returns("Database.all()");
      existsSync.returns(true);

      await run(`query --secret=foo --input "test.fql"`, container);

      expect(existsSync).to.have.been.calledWith("test.fql");
      expect(readFileSync).to.have.been.calledWith("test.fql", "utf8");
      expect(runQueryFromString).to.have.been.calledWith("Database.all()");
    });

    it("can output results to a file", async function () {
      const { writeFileSync } = container.resolve("fs");
      const testData = {
        name: "test",
        coll: "Database",
        ts: 'Time("2024-07-16T19:16:15.980Z")',
        global_id: "asd7zi8pharfn",
      };
      const testResponse = createV10QuerySuccess(testData);
      runQueryFromString.resolves(testResponse);

      await run(
        `query --secret=foo --output "result.json" "Database.all()" --format json`,
        container,
      );

      expect(writeFileSync).to.have.been.calledWith(
        "result.json",
        JSON.stringify(testData, null, 2),
      );
    });

    it("can provide a timeout option", async function () {
      await run(
        `query "Database.all()" --secret=foo --timeout 9000`,
        container,
      );
      expect(runQueryFromString).to.have.been.calledWith(
        '"Database.all()"',
        sinon.match({
          timeout: 9000,
        }),
      );
    });

    it("uses 10 for the default apiVersion", async function () {
      await run(`query "Database.all()" --secret=foo`, container);
      expect(runQueryFromString).to.have.been.calledWith(
        sinon.match.string,
        sinon.match({
          apiVersion: "10",
        }),
      );
    });

    it.skip("can colorize output by default", async function () {
      runQueryFromString.resolves({ data: [] });
      await run(`query "Database.all()" --secret=foo --format json`, container);

      const expected = JSON.stringify([], null, 2);
      expect(logger.stdout).to.have.been.calledWith(expected);
      expect(container.resolve("colorize")).to.have.been.calledWith(expected);
    });

    it.skip("can colorize bare strings", async function () {
      runQueryFromString.resolves({ data: "foo" });
      await run(`query "foo" --secret=foo --format json`, container);

      const expected = JSON.stringify("foo", null, 2);
      expect(logger.stdout).to.have.been.calledWith(expected);
      expect(container.resolve("colorize")).to.have.been.calledWith(expected);
    });

    it("does not colorize output if --no-color is used", async function () {
      runQueryFromString.resolves({ data: [] });
      await run(
        `query "Database.all()" --secret=foo --no-color --json`,
        container,
      );
      expect(logger.stdout).to.have.been.calledWith(
        colorize([], { format: "json", color: false }),
      );
    });

    it("cannot specify '--include none' with any other options", async function () {
      try {
        await run(`query "foo" --secret=foo --include none summary`, container);
      } catch (e) {}

      expect(logger.stderr).to.have.been.calledWith(
        sinon.match(
          "'--include none' cannot be used with other include options.",
        ),
      );
    });
  });

  describe("--local usage", function () {
    it("calls query with a default secret of 'secret'", async function () {
      const testData = "fql";
      const testResponse = createV10QuerySuccess(testData);
      runQueryFromString.resolves(testResponse);

      await run(`query "Database.all()" --local`, container);

      expect(runQueryFromString).to.have.been.calledWith(
        '"Database.all()"',
        sinon.match({
          apiVersion: "10",
          secret: "secret",
          url: "http://0.0.0.0:8443",
        }),
      );
    });

    it("calls query with a scoped secret when a database argument is provided", async function () {
      const testData = "fql";
      const testResponse = createV10QuerySuccess(testData);
      runQueryFromString.resolves(testResponse);

      await run(`query "Database.all()" --local --database Taco`, container);

      expect(runQueryFromString).to.have.been.calledWith(
        '"Database.all()"',
        sinon.match({
          apiVersion: "10",
          secret: "secret:Taco:admin",
          url: "http://0.0.0.0:8443",
        }),
      );
    });

    it("calls query with a scoped secret when a role argument is provided", async function () {
      const testData = "fql";
      const testResponse = createV10QuerySuccess(testData);
      runQueryFromString.resolves(testResponse);

      await run(`query "Database.all()" --local --role MyRole`, container);

      expect(runQueryFromString).to.have.been.calledWith(
        '"Database.all()"',
        sinon.match({
          apiVersion: "10",
          secret: "secret:MyRole",
          url: "http://0.0.0.0:8443",
        }),
      );
    });

    it("calls query with a scoped secret when a role and database argument ares provided", async function () {
      const testData = "fql";
      const testResponse = createV10QuerySuccess(testData);
      runQueryFromString.resolves(testResponse);

      await run(
        `query "Database.all()" --local --role MyRole --database Db`,
        container,
      );

      expect(runQueryFromString).to.have.been.calledWith(
        '"Database.all()"',
        sinon.match({
          apiVersion: "10",
          secret: "secret:Db:MyRole",
          url: "http://0.0.0.0:8443",
        }),
      );
    });
  });

  describe("v10", function () {
    it("can output the result of a query", async function () {
      const testData = {
        name: "Test",
        coll: "Database",
        ts: "2024-10-30T21:31:32.770Z",
        data: {},
        global_id: "ys6ydpq14yynr",
      };
      const testResponse = createV10QuerySuccess(testData);
      runQueryFromString.resolves(testResponse);

      await run(`query "Database.all()" --secret=foo --format json`, container);

      expect(runQueryFromString).to.have.been.calledWith(
        '"Database.all()"',
        sinon.match({
          apiVersion: "10",
        }),
      );
      expect(logger.stdout).to.have.been.calledWith(
        colorize(testData, { format: "json", color: true }),
      );
      expect(logger.stderr).to.not.be.called;
    });

    it("can output an error message", async function () {
      const testSummary = createV10QueryFailure("test query");
      runQueryFromString.rejects(new ServiceError(testSummary));

      try {
        await run(`query "Database.all()" --secret=foo`, container);
      } catch (e) {}

      expect(logger.stdout).to.not.be.called;
      expect(logger.stderr).to.have.been.calledWith(sinon.match(/test query/));
    });

    it("can set the typecheck option to true", async function () {
      await run(`query "Database.all()" --typecheck --secret=foo`, container);
      expect(runQueryFromString).to.have.been.calledWith(
        '"Database.all()"',
        sinon.match({
          typecheck: true,
        }),
      );
    });

    it("can set the performanceHints option to true", async function () {
      await run(
        `query "Database.all()" --performance-hints --secret=foo`,
        container,
      );
      expect(runQueryFromString).to.have.been.calledWith(
        '"Database.all()"',
        sinon.match({
          performanceHints: true,
        }),
      );
    });

    describe("--include usage", function () {
      it("can set the include option to '[summary]' by default", async function () {
        await run(`query "foo" --secret=foo`, container);

        expect(formatQueryInfo.getCall(0).args[1].include).to.deep.equal([
          "summary",
        ]);
      });

      it("can set the include option to an array", async function () {
        await run(
          `query "foo" --secret=foo --include summary stats`,
          container,
        );

        expect(formatQueryInfo.getCall(0).args[1].include).to.deep.equal([
          "summary",
          "stats",
        ]);
      });

      it("can specify '--include all' to set all include options", async function () {
        await run(`query "foo" --secret=foo --include all`, container);

        expect(formatQueryInfo.getCall(0).args[1].include).to.deep.equal(
          QUERY_INFO_CHOICES,
        );
      });

      it("can specify '--include none' to set no include options", async function () {
        await run(`query "foo" --secret=foo --include none`, container);

        expect(formatQueryInfo).to.not.be.called;
      });

      it("displays summary by default", async function () {
        runQueryFromString.resolves({
          summary: "info at *query*:1: hello world",
          data: "fql",
        });

        await run(
          `query "Database.all()" --performance-hints --secret=foo`,
          container,
        );

        expect(logger.stderr).to.have.been.calledWith(
          sinon.match(/hello world/),
        );
        expect(container.resolve("codeToAnsi")).to.have.been.calledWith(
          sinon.match(/hello world/),
          "yaml",
        );
        expect(logger.stdout).to.have.been.calledWith(sinon.match(/fql/));
      });

      it("still displays performance hints if '--include none' is used", async function () {
        runQueryFromString.resolves({
          summary:
            "performance_hint: use a more efficient query\n1 | use a more efficient query",
          data: "fql",
        });

        await run(
          `query "Database.all()" --performance-hints --secret=foo --include none`,
          container,
        );

        expect(logger.stderr).to.have.been.calledWith(
          sinon.match(/use a more efficient query/),
        );
        expect(container.resolve("codeToAnsi")).to.have.been.calledWith(
          sinon.match(/use a more efficient query/),
          "fql",
        );
        expect(logger.stdout).to.have.been.calledWith(sinon.match(/fql/));
      });

      it("does not display anything if info fields are empty", async function () {
        runQueryFromString.resolves({
          txn_ts: "",
          schema_version: "",
          summary: "",
          query_tags: "",
          stats: "",
          data: "fql",
        });

        await run(`query "test" --secret=foo --include all`, container);

        expect(logger.stderr).to.not.be.called;
        expect(logger.stdout).to.have.been.calledWith(sinon.match(/fql/));
      });

      QUERY_INFO_CHOICES.forEach((choice) => {
        it(`displays ${choice} if '--include ${choice}' is used, but not others`, async function () {
          runQueryFromString.resolves({
            txn_ts: "foo",
            schema_version: "foo",
            summary: "foo",
            query_tags: "foo",
            stats: "foo",
            data: "fql",
          });

          await run(`query "test" --secret=foo --include ${choice}`, container);

          expect(logger.stderr).to.have.been.calledWith(
            sinon.match(new RegExp(`${choice}:`)),
          );

          const ignoredChoices = QUERY_INFO_CHOICES.filter((o) => o !== choice);
          for (const ignored of ignoredChoices) {
            expect(logger.stderr).to.not.have.been.calledWith(
              sinon.match(new RegExp(`${ignored}:`)),
            );
          }
        });
      });
    });

    it("can handle network errors", async function () {
      runQueryFromString.rejects(new NetworkError("test error", { cause: {} }));

      try {
        await run(`query "Database.all()" --local`, container);
      } catch (e) {}

      expect(logger.stderr).to.have.been.calledWith(
        sinon.match(NETWORK_ERROR_MESSAGE),
      );
    });
  });

  describe("v4", function () {
    it("can output the result of a query", async function () {
      const testData = {
        "@ref": {
          id: "test",
          collection: {
            "@ref": {
              id: "collections",
            },
          },
        },
      };
      const testResponse = createV4QuerySuccess(testData);
      runQueryFromString.resolves(testResponse);

      await run(
        `query "Collection('test')" --apiVersion 4 --secret=foo`,
        container,
      );

      expect(runQueryFromString).to.have.been.calledWith(
        "\"Collection('test')\"",
        sinon.match({
          apiVersion: "4",
        }),
      );
      expect(logger.stdout).to.have.been.calledWith(
        colorize(testData, { format: "json", color: true }),
      );
      expect(logger.stderr).to.not.be.called;
    });

    it("can output an error message", async function () {
      const testError = createV4QueryFailure({
        position: ["paginate", "collections"],
        code: "invalid argument",
        description: "Database Ref or Null expected, String provided.",
      });

      // @ts-ignore
      runQueryFromString.rejects(testError);

      try {
        await run(
          `query "Paginate(Collection('x'))" --apiVersion 4 --secret=foo`,
          container,
        );
      } catch (e) {}

      expect(logger.stdout).to.not.be.called;
      expect(logger.stderr).to.have.been.calledWith(
        sinon.match(
          "invalid argument: Database Ref or Null expected, String provided. at paginate, collections",
        ),
      );
    });
  });
});

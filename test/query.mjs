//@ts-check

import { expect } from "chai";
import { ServiceError } from "fauna";
import { colorize } from "json-colorizer";
import sinon from "sinon";

import { run } from "../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../src/config/setup-test-container.mjs";
import { formatObjectForShell } from "../src/lib/misc.mjs";
import { createV4QueryFailure, createV4QuerySuccess, createV10QueryFailure, createV10QuerySuccess } from "./helpers.mjs";

describe("query", function () {
  let container, logger, runQueryFromString;

  beforeEach(() => {
    container = setupContainer();
    logger = container.resolve("logger");
    runQueryFromString = container.resolve("runQueryFromString");

    // Set a default empty response for all queries
    runQueryFromString.resolves({ data: [] });
  });

  describe("common", function () {
    it("requires --input or [fql]", async function () {
      try {
        await run(`query --secret=foo`, container);
      } catch (e) {}

      expect(logger.stderr).to.have.been.calledWith(sinon.match("No query specified. Pass [fql] or --input."));
    });

    it("does not allow both --input and [fql]", async function () {
      try {
        await run(`query --secret=foo --input "test.fql" "Database.all()"`, container);
      } catch (e) {}

      expect(logger.stderr).to.have.been.calledWith(sinon.match("Cannot specify both --input and [fql]"));
    });

    it("requires a file passed to --input to exist", async function () {
      try {
        await run(`query --secret=foo --input "nonexistent.fql"`, container);
      } catch (e) {}

      expect(logger.stderr).to.have.been.calledWith(sinon.match("File passed to --input does not exist: nonexistent.fql"));
    });

    it("requires write access to the directory passed to --output", async function () {
      container.resolve("fs").accessSync.throws(new Error("EACCES"));
      container.resolve("dirname").returns("/var/nonexistent");

      try {
        await run(`query --secret=foo --output "/var/nonexistent/result.json" "Database.all()"`, container);
      } catch (e) {}

      expect(logger.stderr).to.have.been.calledWith(sinon.match("Unable to write to output directory: /var/nonexistent"));
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
      expect(runQueryFromString).to.have.been.calledWith("Database.all()")
    });

    it("can output results to a file", async function () {
      const { writeFileSync } = container.resolve("fs");
      const testData = {
        name: "test",
        coll: "Database",
        ts: 'Time("2024-07-16T19:16:15.980Z")',
        global_id: "asd7zi8pharfn",
      }
      const testResponse = createV10QuerySuccess(testData);
      runQueryFromString.resolves(testResponse);

      await run(`query --secret=foo --output "result.json" "Database.all()"`, container);

      expect(writeFileSync).to.have.been.calledWith("result.json", JSON.stringify(testData, null, 2));
    });

    it("can provide a timeout option", async function () {
      await run(`query "Database.all()" --secret=foo --timeout 9000`, container);
      expect(runQueryFromString).to.have.been.calledWith("\"Database.all()\"", sinon.match({
        timeout: 9000
      }));
    });

    it("uses 10 for the default apiVersion", async function () {
      await run(`query "Database.all()" --secret=foo`, container);
      expect(runQueryFromString).to.have.been.calledWith(sinon.match.string, sinon.match({
        apiVersion: '10'
      }));
    });

    // This test is skipped for now because we need to figure out a clean way to 
    // toggle whether our test stdout is a TTY or not.
    it.skip("can colorize output by default", async function () {
      runQueryFromString.resolves({ data: [] });
      await run(`query "Database.all()" --secret=foo`, container);
      expect(logger.stdout).to.have.been.calledWith(colorize([]));
    });

    it("does not colorize output if --no-color is used", async function () {
      runQueryFromString.resolves({ data: [] });
      await run(`query "Database.all()" --secret=foo --no-color`, container);
      expect(logger.stdout).to.have.been.calledWith(JSON.stringify([], null, 2));
    });

    // This test is disabled because the argv fallback requires a real process.argv
    // and there's no way blessed way to override it in the test environment.
    it.skip("can mute stderr if --quiet is used", async function () {
      runQueryFromString.rejects(new Error('test error'));
      
      try {
        await run(`query "Database.all()" --quiet --secret=foo`, container);
      } catch (e) {}

      expect(logger.stdout).to.not.be.called;
      expect(logger.stderr).to.not.be.called;
    });
  });

  describe("v10", function () {
    it("can output the result of a query", async function () {
      const testData = {
        name: "Test",
        coll: "Database",
        ts: "2024-10-30T21:31:32.770Z",
        data: {},
        global_id: "ys6ydpq14yynr"
      }
      const testResponse = createV10QuerySuccess(testData);
      runQueryFromString.resolves(testResponse);

      await run(`query "Database.all()" --secret=foo`, container);

      expect(runQueryFromString).to.have.been.calledWith("\"Database.all()\"", sinon.match({
        apiVersion: '10'
      }));
      expect(logger.stdout).to.have.been.calledWith(formatObjectForShell(testData));
      expect(logger.stderr).to.not.be.called;
    });

    it("can output additional response fields via --extra", async function () {
      const testData = {
        name: "test",
        coll: "Database",
        ts: 'Time("2024-07-16T19:16:15.980Z")',
        global_id: "asd7zi8pharfn",
      }
      const testResponse = createV10QuerySuccess(testData);
      runQueryFromString.resolves(testResponse);

      await run(`query "Database.all()" --extra --secret=foo`, container);

      expect(logger.stdout).to.have.been.calledWith(formatObjectForShell(testResponse));
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


    it("can output the full error object when --extra is used", async function () {
      const failure = createV10QueryFailure("test query");
      const error = new ServiceError(failure);
      runQueryFromString.rejects(error);
      
      try {
        await run(`query "Database.all()" --extra --secret=foo`, container);
      } catch (e) {}

      expect(logger.stdout).to.not.be.called;
      expect(logger.stderr).to.have.been.calledWith(sinon.match(/queryInfo/));
    });

    it("can set the typecheck option to true", async function () {
      await run(`query "Database.all()" --typecheck --secret=foo`, container);
      expect(runQueryFromString).to.have.been.calledWith("\"Database.all()\"", sinon.match({
        typecheck: true
      }));
    });
  });

  describe("v4", function () {
    it("can output the result of a query", async function () {
      const testData = {
        "@ref": {
          "id": "test",
          "collection": {
            "@ref": {
              "id": "collections"
            }
          }
        }
      }
      const testResponse = createV4QuerySuccess(testData);
      runQueryFromString.resolves(testResponse);

      await run(`query "Collection('test')" --apiVersion 4 --secret=foo`, container);

      expect(runQueryFromString).to.have.been.calledWith("\"Collection('test')\"", sinon.match({
        apiVersion: '4'
      }));
      expect(logger.stdout).to.have.been.calledWith(formatObjectForShell(testData));
      expect(logger.stderr).to.not.be.called;
    });

    it("can output additional response fields via --extra", async function () {
      const testData = {
        "@ref": {
          "id": "test",
          "collection": {
            "@ref": {
              "id": "collections"
            }
          }
        }
      }
      const testResponse = createV4QuerySuccess(testData);
      runQueryFromString.resolves(testResponse);

      await run(`query "Collection('test')" --extra --apiVersion 4 --secret=foo`, container);

      expect(logger.stdout).to.have.been.calledWith(formatObjectForShell(testResponse));
      expect(logger.stderr).to.not.be.called;
    });

    it("can output an error message", async function () {
      const testError = createV4QueryFailure({
        position: ["paginate", "collections"],
        code: "invalid argument",
        description: "Database Ref or Null expected, String provided."
      });

      // @ts-ignore
      runQueryFromString.rejects(testError);
  
      try {
        await run(`query "Paginate(Collection('x'))" --apiVersion 4 --secret=foo`, container);
      } catch (e) {}

      expect(logger.stdout).to.not.be.called;
      expect(logger.stderr).to.have.been.calledWith(sinon.match("invalid argument: Database Ref or Null expected, String provided. at paginate, collections"));
    });


    it("can output the full error object when --extra is used", async function () {
      const testError = createV4QueryFailure({
        position: ["paginate", "collections"],
        code: "invalid argument",
        description: "Database Ref or Null expected, String provided."
      });

      // @ts-ignore
      runQueryFromString.rejects(testError);
  
      try {
        await run(`query "Paginate(Collection('x'))" --apiVersion 4 --extra --secret=foo`, container);
      } catch (e) {}

      expect(logger.stdout).to.not.be.called;
      expect(logger.stderr).to.have.been.calledWith(sinon.match(/requestResult/));
    });
  });
});

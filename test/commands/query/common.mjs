//@ts-check

import { expect } from "chai";
import sinon from "sinon";

import { run } from "../../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../../src/config/setup-test-container.mjs";
import { colorize } from "../../../src/lib/formatting/colorize.mjs";
import { createV10QuerySuccess } from "../../helpers.mjs";

describe("query common", function () {
  let container, logger, runQueryFromString;

  beforeEach(() => {
    container = setupContainer();
    logger = container.resolve("logger");
    runQueryFromString = container.resolve("runQueryFromString");

    // Set a default empty response for all queries
    runQueryFromString.resolves({ data: "test" });
  });

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
    await run(`query "Database.all()" --secret=foo --timeout 9000`, container);
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
});

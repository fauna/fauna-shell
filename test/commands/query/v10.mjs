//@ts-check

import { expect } from "chai";
import {
  AbortError,
  ConstraintFailureError,
  NetworkError,
  ServiceError,
} from "fauna";
import sinon from "sinon";

import { run } from "../../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../../src/config/setup-test-container.mjs";
import { NETWORK_ERROR_MESSAGE } from "../../../src/lib/errors.mjs";
import { colorize } from "../../../src/lib/formatting/colorize.mjs";
import { QUERY_INFO_CHOICES } from "../../../src/lib/options.mjs";
import {
  createV10QueryFailure,
  createV10QuerySuccess,
} from "../../helpers.mjs";

describe("query v10", function () {
  let container, logger, runQueryFromString;

  beforeEach(() => {
    container = setupContainer();
    logger = container.resolve("logger");
    runQueryFromString = container.resolve("runQueryFromString");

    // Set a default empty response for all queries
    runQueryFromString.resolves({ data: "test" });
  });

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
  it("can display additional info for abort errors", async function () {
    const testSummary = createV10QueryFailure("test query");
    runQueryFromString.rejects(
      new AbortError({
        ...testSummary,
        error: { ...testSummary.error, abort: `"oops"` },
      }),
    );

    try {
      await run(`query "abort('oops')" --secret=foo`, container);
    } catch (e) {}

    expect(logger.stdout).to.not.be.called;
    expect(logger.stderr).to.have.been.calledWith(sinon.match(/test query/));
    // sample individual output lines to avoid matching with color codes
    expect(logger.stderr).to.have.been.calledWith(sinon.match("Abort value:"));
    expect(logger.stderr).to.have.been.calledWith(sinon.match('"oops"'));
  });

  it("can display additional info for constraint failure errors", async function () {
    const testSummary = createV10QueryFailure("test query");
    runQueryFromString.rejects(
      new ConstraintFailureError({
        ...testSummary,
        error: {
          ...testSummary.error,
          constraint_failures: [
            {
              paths: [["name"]],
              message: "A Collection already exists with the name `foo`",
            },
          ],
        },
      }),
    );

    try {
      await run(
        `query "Collection.create({name: 'foo'})" --secret=foo`,
        container,
      );
    } catch (e) {}

    expect(logger.stdout).to.not.be.called;
    expect(logger.stderr).to.have.been.calledWith(sinon.match(/test query/));
    // sample individual output lines to avoid matching with color codes
    expect(logger.stderr).to.have.been.calledWith(
      sinon.match("Constraint failures:"),
    );
    expect(logger.stderr).to.have.been.calledWith(
      sinon.match("A Collection already exists with the name `foo`"),
    );
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

  it("can set the maxAttempts option to true", async function () {
    await run(
      `query "Database.all()" --max-attempts 5 --secret=foo`,
      container,
    );
    expect(runQueryFromString).to.have.been.calledWith(
      '"Database.all()"',
      sinon.match({
        maxAttempts: 5,
      }),
    );
  });

  it("can set the maxBackoff option to true", async function () {
    await run(
      `query "Database.all()" --max-backoff 2000 --secret=foo`,
      container,
    );
    expect(runQueryFromString).to.have.been.calledWith(
      '"Database.all()"',
      sinon.match({
        maxBackoff: 2000,
      }),
    );
  });

  describe("query info", function () {
    it("displays summary by default", async function () {
      runQueryFromString.resolves({
        summary: "info at *query*:1: hello world",
        data: "fql",
      });

      await run(
        `query "Database.all()" --performance-hints --secret=foo`,
        container,
      );

      expect(logger.stderr).to.have.been.calledWith(sinon.match(/hello world/));
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

    it("can display query info with an error", async function () {
      const testSummary = createV10QueryFailure("test query");
      runQueryFromString.rejects(new ServiceError(testSummary));

      try {
        await run(
          `query "Database.all()" --secret=foo --include all`,
          container,
        );
      } catch (e) {}

      expect(logger.stdout).to.not.be.called;
      // sample individual output lines to avoid matching with color codes
      expect(logger.stderr).to.have.been.calledWith(
        sinon.match("txnTs: 1732664445755210"),
      );
      expect(logger.stderr).to.have.been.calledWith(sinon.match("stats:"));
      expect(logger.stderr).to.have.been.calledWith(sinon.match(/test query/));
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

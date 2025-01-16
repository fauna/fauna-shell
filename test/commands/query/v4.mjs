//@ts-check

import util from "node:util";

import { expect } from "chai";
import faunadb from "faunadb";
import sinon from "sinon";

import { run } from "../../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../../src/config/setup-test-container.mjs";
import { colorize } from "../../../src/lib/formatting/colorize.mjs";
import { createV4QueryFailure, createV4QuerySuccess } from "../../helpers.mjs";

describe("query v4", function () {
  let container, logger, runQueryFromString;

  beforeEach(() => {
    container = setupContainer();
    logger = container.resolve("logger");
    runQueryFromString = container.resolve("runQueryFromString");

    // Set a default empty response for all queries
    runQueryFromString.resolves({ data: "test" });
  });

  const testResponseWireProtocol = {
    "@ref": { id: "test", collection: { "@ref": { id: "collections" } } },
  };
  const testResponseFQL = faunadb.parseJSON(
    JSON.stringify(testResponseWireProtocol),
  );
  const testResponse = createV4QuerySuccess(testResponseFQL);
  const runQueryExpectArgs = [
    "\"Collection('test')\"",
    sinon.match({ apiVersion: "4" }),
  ];

  it("can output the result of a query as FQL", async function () {
    runQueryFromString.resolves(testResponse);
    await run(
      `query "Collection('test')" --apiVersion 4 --secret=foo`,
      container,
    );

    expect(runQueryFromString).to.have.been.calledWith(...runQueryExpectArgs);
    const output = util.inspect(testResponseFQL, {
      showHidden: false,
      depth: null,
    });
    expect(logger.stdout).to.have.been.calledWith(
      colorize(output, { language: "fql", color: true }),
    );
    expect(logger.stderr).to.not.be.called;
  });

  it("can output the result of a query as JSON", async function () {
    runQueryFromString.resolves(testResponse);
    await run(
      `query "Collection('test')" --apiVersion 4 --secret=foo -f json`,
      container,
    );

    expect(runQueryFromString).to.have.been.calledWith(...runQueryExpectArgs);
    expect(logger.stdout).to.have.been.calledWith(
      colorize(testResponseWireProtocol, { language: "json", color: true }),
    );
    expect(logger.stderr).to.not.be.called;
  });

  ["true", "false", "'string'", 42, null, { foo: "bar" }].forEach((query) =>
    it(`can query basic value '${query}'`, async function () {
      runQueryFromString.resolves(createV4QuerySuccess(query));
      await run(`query "null" --apiVersion 4 --secret=foo`, container);
      expect(logger.stdout).to.have.been.calledWith(
        colorize(util.inspect(query), { language: "fql", color: true }),
      );
      expect(logger.stderr).to.not.be.called;
    }),
  );

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

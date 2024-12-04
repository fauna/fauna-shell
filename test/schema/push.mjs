//@ts-check

import { expect } from "chai";
import sinon from "sinon";

import { run } from "../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../src/config/setup-test-container.mjs";
import { reformatFSL } from "../../src/lib/schema.mjs";
import { buildUrl, f } from "../helpers.mjs";

describe("schema push", function () {
  const diffString =
    "\u001b[1;34m* Modifying collection `Customer`\u001b[0m at collections.fsl:2:1:\n  * Defined fields:\n\u001b[31m  - drop field `.age`\u001b[0m\n\n";
  let container, gatherFSL, fetch, logger, confirm;
  let fsl = [
    {
      name: "coll.fsl",
      content:
        "collection MyColl {\\n  name: String\\n  index byName {\\n    terms [.name]\\n  }\\n}\\n",
    },
  ];

  beforeEach(() => {
    container = setupContainer();

    gatherFSL = container.resolve("gatherFSL");
    fetch = container.resolve("fetch");
    logger = container.resolve("logger");
    confirm = container.resolve("confirm");

    gatherFSL.resolves(fsl);
  });

  it("can push a schema without user input", async function () {
    await run(`schema push --secret "secret" --no-input`, container);

    expect(gatherFSL).to.have.been.calledWith(".");

    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/update", { staged: "true" }),
      {
        method: "POST",
        headers: { AUTHORIZATION: "Bearer secret" },
        body: reformatFSL(fsl),
      },
    );

    expect(logger.stdout).to.not.be.called;
    expect(logger.stderr).to.not.be.called;
  });

  it("can push schema by version to staged (default)", async function () {
    // user accepts the changes in the interactive prompt
    confirm.resolves(true);

    fetch.onCall(0).resolves(
      f({
        // this is the version we provide when we mutate the resource
        version: 1728675598430000,
        diff: diffString,
      }),
    );

    fetch.onCall(1).resolves(
      f({
        // this is the new version, and won't be used again in this transaction
        version: 1728677126240000,
      }),
    );

    await run(`schema push --secret "secret"`, container);

    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/diff", {
        staged: "true",
        color: "ansi",
      }),
      {
        method: "POST",
        headers: { AUTHORIZATION: "Bearer secret" },
        body: reformatFSL(fsl),
      },
    );

    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/update", {
        version: "1728675598430000",
        staged: "true",
      }),
      {
        method: "POST",
        headers: { AUTHORIZATION: "Bearer secret" },
        body: reformatFSL(fsl),
      },
    );

    expect(logger.stderr).to.not.be.called;
    expect(logger.stdout).to.have.been.calledWith("Proposed diff:\n");
    expect(confirm).to.have.been.calledWith(
      sinon.match.has("message", "Stage the above changes?"),
    );
    expect(logger.stdout).to.have.been.calledWith(diffString);
  });

  it("can push schema by version to active", async function () {
    // user accepts the changes in the interactive prompt
    confirm.resolves(true);

    fetch.onCall(0).resolves(
      f({
        // this is the version we provide when we mutate the resource
        version: 1728675598430000,
        diff: diffString,
      }),
    );

    fetch.onCall(1).resolves(
      f({
        // this is the new version, and won't be used again in this transaction
        version: 1728677126240000,
      }),
    );

    await run(`schema push --secret "secret" --active`, container);

    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/diff", {
        staged: "false",
        color: "ansi",
      }),
      {
        method: "POST",
        headers: { AUTHORIZATION: "Bearer secret" },
        body: reformatFSL(fsl),
      },
    );

    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/update", {
        version: "1728675598430000",
        staged: "false",
      }),
      {
        method: "POST",
        headers: { AUTHORIZATION: "Bearer secret" },
        body: reformatFSL(fsl),
      },
    );

    expect(logger.stderr).to.not.be.called;
    expect(logger.stdout).to.have.been.calledWith("Proposed diff:\n");
    expect(confirm).to.have.been.calledWith(
      sinon.match.has("message", "Push the above changes?"),
    );
    expect(logger.stdout).to.have.been.calledWith(diffString);
  });

  it("can be cancelled by the user before making mutating network calls", async function () {
    // user rejects the changes in the interactive prompt
    confirm.resolves(false);

    fetch.onCall(0).resolves(
      f({
        // this is the version we provide when we mutate the resource
        version: 1728675598430000,
        diff: diffString,
      }),
    );

    await run(`schema push --secret "secret"`, container);

    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/diff", {
        staged: "true",
        color: "ansi",
      }),
      {
        method: "POST",
        headers: { AUTHORIZATION: "Bearer secret" },
        body: reformatFSL(fsl),
      },
    );

    expect(fetch).to.have.been.calledOnce;

    expect(logger.stderr).to.not.be.called;
    expect(logger.stdout).to.have.been.calledWith("Proposed diff:\n");
    expect(logger.stdout).to.have.been.calledWith(diffString);
  });

  it("can push schema from another directory", async function () {
    await run(
      `schema push --secret "secret" --no-input --dir "/absolute/path/elsewhere"`,
      container,
    );

    expect(gatherFSL).to.have.been.calledWith("/absolute/path/elsewhere");
  });

  it("warns when attempting to stage an empty diff", async function () {
    // user accepts the changes in the interactive prompt
    confirm.resolves(true);

    fetch.onCall(0).resolves(
      f({
        // this is the version we provide when we mutate the resource
        version: 1728675598430000,
        // note: no diff
      }),
    );

    await run(`schema push --secret "secret"`, container);

    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/diff", {
        staged: "true",
        color: "ansi",
      }),
      {
        method: "POST",
        headers: { AUTHORIZATION: "Bearer secret" },
        body: reformatFSL(fsl),
      },
    );

    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/update", {
        version: "1728675598430000",
        staged: "true",
      }),
      {
        method: "POST",
        headers: { AUTHORIZATION: "Bearer secret" },
        body: reformatFSL(fsl),
      },
    );

    expect(logger.stderr).to.not.be.called;
    expect(logger.stdout).to.have.been.calledWith("No logical changes.");
    expect(confirm).to.have.been.calledWith(
      sinon.match.has("message", "Stage the file contents anyway?"),
    );
  });

  it("warns when attempting to push an empty diff", async function () {
    // user accepts the changes in the interactive prompt
    confirm.resolves(true);

    fetch.onCall(0).resolves(
      f({
        // this is the version we provide when we mutate the resource
        version: 1728675598430000,
        // note: no diff
      }),
    );

    await run(`schema push --secret "secret" --active`, container);

    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/diff", {
        staged: "false",
        color: "ansi",
      }),
      {
        method: "POST",
        headers: { AUTHORIZATION: "Bearer secret" },
        body: reformatFSL(fsl),
      },
    );

    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/update", {
        version: "1728675598430000",
        staged: "false",
      }),
      {
        method: "POST",
        headers: { AUTHORIZATION: "Bearer secret" },
        body: reformatFSL(fsl),
      },
    );

    expect(logger.stderr).to.not.be.called;
    expect(logger.stdout).to.have.been.calledWith("No logical changes.");
    expect(confirm).to.have.been.calledWith(
      sinon.match.has("message", "Push the file contents anyway?"),
    );
  });

  it.skip("correctly URI encodes file paths");
});

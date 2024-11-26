//@ts-check

import { expect } from "chai";

import { run } from "../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../src/config/setup-test-container.mjs";
import { reformatFSL } from "../../src/lib/schema.mjs";
import { buildUrl, commonFetchParams, f } from "../helpers.mjs";

describe("schema diff", function () {
  const colorDiffString =
    "\u001B[1;34m* Removing collection `Todo`\u001B[0m from main.fsl:8:1:\n\n\u001B[31m  - collection Todo {\u001B[0m\n\u001B[31m  -   history_days 0\u001B[0m\n\u001B[31m  - }\u001B[0m\n\n";
  const noColorDiffString =
    "* Removing collection `Todo` from main.fsl:8:1:\n\n  - collection Todo {\n  -   history_days 0\n  - }\n\n";
  let container, logger, fetch, gatherFSL;
  const fsl = [
    {
      name: "coll.fsl",
      content:
        "collection MyColl {\\n  name: String\\n  index byName {\\n    terms [.name]\\n  }\\n}\\n",
    },
  ];

  beforeEach(() => {
    container = setupContainer();
    logger = container.resolve("logger");
    fetch = container.resolve("fetch");
    gatherFSL = container.resolve("gatherFSL");

    gatherFSL.resolves(fsl);
  });

  it("can display the diff between local and staged remote schema", async function () {
    fetch.resolves(
      f({
        version: 0,
        diff: colorDiffString,
      }),
    );

    await run(`schema diff --secret "secret"`, container);

    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/staged/status", { color: "ansi" }),
      { ...commonFetchParams, method: "GET" },
    );
    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/validate", {
        color: "ansi",
        diff: "semantic",
        force: "true",
        staged: "true",
      }),
      { ...commonFetchParams, method: "POST", body: reformatFSL(fsl) },
    );
    expect(logger.stdout).to.have.been.calledWith(colorDiffString);
    expect(logger.stderr).to.not.have.been.called;
  });

  it("can display the diff between local and active remote schema", async function () {
    fetch.resolves(
      f({
        version: 0,
        diff: colorDiffString,
      }),
    );

    await run(`schema diff --active --secret "secret"`, container);

    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/staged/status", { color: "ansi" }),
      { ...commonFetchParams, method: "GET" },
    );
    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/validate", {
        color: "ansi",
        diff: "semantic",
        force: "true",
        staged: "false",
      }),
      { ...commonFetchParams, method: "POST", body: reformatFSL(fsl) },
    );
    expect(logger.stdout).to.have.been.calledWith(colorDiffString);
    expect(logger.stderr).to.not.have.been.called;
  });

  it("can display the diff without color (terminal escape codes)", async function () {
    fetch.resolves(
      f({
        version: 0,
        diff: noColorDiffString,
      }),
    );

    await run(`schema diff --secret "secret" --no-color`, container);

    expect(fetch).to.have.been.calledWith(buildUrl("/schema/1/staged/status"), {
      ...commonFetchParams,
      method: "GET",
    });
    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/validate", {
        force: "true",
        staged: "true",
        diff: "semantic",
      }),
      { ...commonFetchParams, method: "POST", body: reformatFSL(fsl) },
    );
    expect(logger.stdout).to.have.been.calledWith(noColorDiffString);
    expect(logger.stderr).to.not.have.been.called;
  });

  it("displays useful output when a diff is empty", async function () {
    fetch.resolves(
      f({
        version: 0,
        diff: "",
      }),
    );

    await run(`schema diff --secret "secret"`, container);

    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/staged/status", { color: "ansi" }),
      { ...commonFetchParams, method: "GET" },
    );
    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/validate", {
        force: "true",
        color: "ansi",
        staged: "true",
        diff: "semantic",
      }),
      { ...commonFetchParams, method: "POST", body: reformatFSL(fsl) },
    );
    expect(logger.stdout).to.have.been.calledWith("No schema differences.");
    expect(logger.stderr).to.not.have.been.called;
  });

  it("can parse relative paths", async function () {
    await run(
      `schema diff --secret "secret" --dir /all/but/the/leaf/..`,
      container,
    );

    expect(gatherFSL).to.have.been.calledWith("/all/but/the");
  });

  it("can parse home directory paths", async function () {
    const homedir = container.resolve("homedir");

    await run(`schema diff --secret "secret" --dir ~`, container);

    expect(gatherFSL).to.have.been.calledWith(homedir);
  });

  it.skip("errors if user provides both --staged and --active flags");
  it.skip("works with the --staged flag");
  it.skip("uses the correct intro string 'from ... to ...'");
});

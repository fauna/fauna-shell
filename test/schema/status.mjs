//@ts-check

import { expect } from "chai";
import chalk from "chalk";

import { run } from "../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../src/config/setup-test-container.mjs";
import { buildUrl, commonFetchParams, f } from "../helpers.mjs";

describe("schema status", function () {
  let container, fetch, logger;

  let summaryDiff =
    "\x1B[1;34m* Adding collection `NewCollection`\x1B[0m to collections.fsl:2:1\n" +
    "\x1B[1;34m* Modifying collection `OrderItem`\x1B[0m at collections.fsl:125:1\n" +
    "\x1B[1;34m* Modifying function `createOrUpdateCartItem`\x1B[0m at functions.fsl:2:1\n";

  beforeEach(() => {
    container = setupContainer();
    fetch = container.resolve("fetch");
    logger = container.resolve("logger");
  });

  it("fetches the current status when there are no changes", async function () {
    fetch.onCall(0).resolves(
      f({
        version: 0,
        status: "none",
        diff: "Staged schema: none",
        pending_summary: "",
      }),
    );
    fetch.onCall(1).resolves(
      f({
        version: 0,
        diff: "",
      }),
    );

    await run(`schema status --secret "secret"`, container);

    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/staged/status", { format: "summary", color: "ansi" }),
      commonFetchParams,
    );
    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/diff", {
        format: "summary",
        staged: "true",
        version: "0",
        color: "ansi",
      }),
      { ...commonFetchParams, method: "POST", body: new FormData() },
    );
    expect(logger.stdout).to.have.been.calledWith(
      `Staged changes: ${chalk.bold("none")}`,
    );
    expect(logger.stdout).to.have.been.calledWith(
      `Local changes: ${chalk.bold("none")}\n`,
    );
  });

  it("fetches the current status when there are only local changes", async function () {
    fetch.onCall(0).resolves(
      f({
        version: 0,
        status: "none",
        diff: "Staged schema: none",
        pending_summary: "",
      }),
    );
    fetch.onCall(1).resolves(
      f({
        version: 0,
        diff:
          "* Adding collection `NewCollection` to collections.fsl:2:1\n" +
          "* Modifying collection `OrderItem` at collections.fsl:125:1\n" +
          "* Modifying function `createOrUpdateCartItem` at functions.fsl:2:1\n",
      }),
    );

    await run(`schema status --secret "secret"`, container);

    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/staged/status", { format: "summary", color: "ansi" }),
      commonFetchParams,
    );
    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/diff", {
        format: "summary",
        staged: "true",
        version: "0",
        color: "ansi",
      }),
      { ...commonFetchParams, method: "POST", body: new FormData() },
    );
    expect(logger.stdout).to.have.been.calledWith(
      `Staged changes: ${chalk.bold("none")}`,
    );
    expect(logger.stdout).to.have.been.calledWith(`Local changes:\n`);
    expect(logger.stdout).to.have.been.calledWith(
      `  * Adding collection \`NewCollection\` to collections.fsl:2:1\n  * Modifying collection \`OrderItem\` at collections.fsl:125:1\n  * Modifying function \`createOrUpdateCartItem\` at functions.fsl:2:1\n  `,
    );
    expect(logger.stdout).to.have.been.calledWith(
      "(use `fauna schema diff` to display local changes)",
    );
    expect(logger.stdout).to.have.been.calledWith(
      "(use `fauna schema push` to stage local changes)",
    );
    expect(logger.stderr).not.to.have.been.called;
  });

  it("fetches the current status when there are only staged changes", async function () {
    fetch.onCall(0).resolves(
      f({
        version: 0,
        status: "ready",
        diff: summaryDiff,
        pending_summary: "",
      }),
    );
    fetch.onCall(1).resolves(
      f({
        version: 0,
        diff: "",
      }),
    );

    await run(`schema status --secret "secret"`, container);

    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/staged/status", { format: "summary", color: "ansi" }),
      commonFetchParams,
    );

    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/diff", {
        format: "summary",
        staged: "true",
        version: "0",
        color: "ansi",
      }),
      { ...commonFetchParams, method: "POST", body: new FormData() },
    );
    expect(logger.stdout).to.have.been.calledWith(
      `Staged changes: ${chalk.bold("ready")}`,
    );
    expect(logger.stdout).to.have.been.calledWith(
      `Local changes: ${chalk.bold("none")}\n`,
    );
    expect(logger.stdout).to.have.been.calledWith(
      summaryDiff.split("\n").join("\n  "),
    );
    expect(logger.stderr).not.to.have.been.called;
  });

  it("fetches the current status when there are both local and staged changes", async function () {
    fetch.onCall(0).resolves(
      f({
        version: 0,
        status: "ready",
        diff: summaryDiff,
        pending_summary: "",
      }),
    );
    fetch.onCall(1).resolves(
      f({
        version: 0,
        diff:
          "* Adding function `newFunction` to functions.fsl:1:1\n" +
          "* Modifying function `createOrUpdateCartItem` at functions.fsl:5:1\n",
      }),
    );

    await run(`schema status --secret "secret"`, container);

    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/staged/status", { format: "summary", color: "ansi" }),
      commonFetchParams,
    );
    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/diff", {
        format: "summary",
        staged: "true",
        version: "0",
        color: "ansi",
      }),
      { ...commonFetchParams, method: "POST", body: new FormData() },
    );
    expect(logger.stdout).to.have.been.calledWith(
      `Staged changes: ${chalk.bold("ready")}`,
    );
    expect(logger.stdout).to.have.been.calledWith(`Staged changes:\n`);
    expect(logger.stdout).to.have.been.calledWith(`Local changes:\n`);
    expect(logger.stdout).to.have.been.calledWith(
      summaryDiff.split("\n").join("\n  "),
    );
    expect(logger.stdout).to.have.been.calledWith(
      "  * Adding function `newFunction` to functions.fsl:1:1\n" +
        "  * Modifying function `createOrUpdateCartItem` at functions.fsl:5:1\n  ",
    );
    expect(logger.stdout).to.have.been.calledWith(
      "(use `fauna schema diff` to display local changes)",
    );
    expect(logger.stdout).to.have.been.calledWith(
      "(use `fauna schema push` to stage local changes)",
    );
    expect(logger.stderr).not.to.have.been.called;
  });

  it("can fetch status without embedded colors (terminal escape codes)", async function () {
    fetch.resolves(
      f({
        version: 0,
        status: "none",
        diff: "Staged schema: none",
      }),
    );
    await run(`schema status --no-color --secret "secret"`, container);

    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/staged/status", { format: "summary" }),
      commonFetchParams,
    );
    expect(logger.stderr).not.to.have.been.called;
  });
});

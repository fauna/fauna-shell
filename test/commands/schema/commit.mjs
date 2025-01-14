//@ts-check

import { expect } from "chai";
import chalk from "chalk";
import sinon from "sinon";
import tryToCatch from "try-to-catch";

import { run } from "../../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../../src/config/setup-test-container.mjs";
import { buildUrl, commonFetchParams, f } from "../../helpers.mjs";

describe("schema commit", function () {
  const textDiff =
    "\u001b[1mcollections.fsl\u001b[22m\n\u001b[36m@ line 9 to 14\u001b[0m\n      postalCode: String,\n      country: String\n    }\n\u001b[31m-   age: Number?\u001b[0m\n\n    compute cart: Order? = (customer => Order.byCustomerAndStatus(customer, 'cart').first())\n\n\u001b[36m@ line 24 to 30\u001b[0m\n\n    migrations {\n      add .age\n\u001b[32m+     drop .age\u001b[0m\n    }\n  }\n\n";
  const diff =
    "\u001b[1;34m* Modifying collection `Customer`\u001b[0m at collections.fsl:2:1:\n  * Defined fields:\n\u001b[31m  - drop field `.age`\u001b[0m\n\n";
  let container, fetch, logger, confirm;

  beforeEach(() => {
    container = setupContainer();
    fetch = container.resolve("fetch");
    logger = container.resolve("logger");
    confirm = container.resolve("confirm");
  });

  it("can commit a schema change", async function () {
    fetch.onCall(0).resolves(
      f({
        version: 1728684450440000,
        status: "ready",
        pending_summary: "",
        diff: diff,
        text_diff: textDiff,
      }),
    );

    fetch.onCall(1).resolves(f({ version: 1728684456180000 }));

    // user accepts the changes in the interactive prompt
    confirm.resolves(true);

    await run(`schema commit --secret "secret"`, container);

    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/staged/status", { diff: "true", color: "ansi" }),
      { ...commonFetchParams, method: "GET" },
    );
    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/staged/commit", { version: "1728684450440000" }),
      { ...commonFetchParams, method: "POST" },
    );
    expect(logger.stdout).to.have.been.calledWith("Schema has been committed");
    expect(logger.stderr).to.not.have.been.called;
    expect(confirm).to.have.been.calledWith(
      sinon.match.has("message", "Accept and commit these changes?"),
    );
  });

  it("can commit a schema change without user input", async function () {
    fetch.onCall(0).resolves(f({ version: 1728684456180000 }));

    await run(`schema commit --secret "secret" --no-input`, container);

    expect(fetch).to.have.been.calledOnce;
    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/staged/commit", { force: "true" }),
      { ...commonFetchParams, method: "POST" },
    );
    expect(logger.stdout).to.have.been.calledWith("Schema has been committed");
    expect(logger.stderr).to.not.have.been.called;
    expect(confirm).to.not.have.been.called;
  });

  it("errors if there is no staged schema change", async function () {
    fetch.onCall(0).resolves(f({ status: "none" }));

    const [error] = await tryToCatch(() =>
      run(`schema commit --secret "secret"`, container),
    );

    expect(error).to.have.property("code", 1);
    expect(fetch).to.have.been.calledOnce;
    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/staged/status", { diff: "true", color: "ansi" }),
      { ...commonFetchParams, method: "GET" },
    );
    expect(logger.stdout).to.not.have.been.called;
    const message = `${chalk.red("There is no staged schema to commit")}`;
    expect(logger.stderr).to.have.been.calledWith(message);
    expect(confirm).to.not.have.been.called;
  });

  it("errors if the schema is not in a ready state", async function () {
    fetch.onCall(0).resolves(f({ status: "building", diff: diff }));

    const [error] = await tryToCatch(() =>
      run(`schema commit --secret "secret"`, container),
    );

    expect(error).to.have.property("code", 1);
    expect(fetch).to.have.been.calledOnce;
    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/staged/status", { diff: "true", color: "ansi" }),
      { ...commonFetchParams, method: "GET" },
    );
    expect(logger.stdout).to.have.been.calledWith(diff);
    const message = `${chalk.red("Schema is not ready to be committed")}`;
    expect(logger.stderr).to.have.been.calledWith(message);
    expect(confirm).to.not.have.been.called;
  });

  it("can be cancelled without making mutating network calls", async function () {
    fetch.onCall(0).resolves(
      f({
        version: 1728684450440000,
        status: "ready",
        pending_summary: "",
        diff: diff,
        text_diff: textDiff,
      }),
    );

    // user rejects the changes in the interactive prompt
    confirm.resolves(false);

    await run(`schema commit --secret "secret"`, container);

    expect(fetch).to.have.been.calledOnce;
    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/staged/status", { diff: "true", color: "ansi" }),
      { ...commonFetchParams, method: "GET" },
    );
    expect(logger.stdout).to.have.been.calledWith("Commit cancelled");
    expect(logger.stderr).to.not.have.been.called;
    expect(confirm).to.have.been.calledWith(
      sinon.match.has("message", "Accept and commit these changes?"),
    );
  });
});

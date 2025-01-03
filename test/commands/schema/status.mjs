//@ts-check

import { expect } from "chai";
import chalk from "chalk";
import sinon from "sinon";

import { run } from "../../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../../src/config/setup-test-container.mjs";
import { reformatFSL } from "../../../src/lib/schema.mjs";
import { buildUrl, commonFetchParams, f } from "../../helpers.mjs";

describe("schema status", function () {
  let container, fetch, logger, gatherFSL;

  let fsl = [
    {
      name: "collections.fsl",
      content: "collection Customer {\n  name: String\n  email: String\n}\n",
    },
  ];

  let summaryDiff =
    "\x1B[1;34m* Adding collection `NewCollection`\x1B[0m to collections.fsl:2:1\n" +
    "\x1B[1;34m* Modifying collection `OrderItem`\x1B[0m at collections.fsl:125:1\n" +
    "\x1B[1;34m* Modifying function `createOrUpdateCartItem`\x1B[0m at functions.fsl:2:1\n";

  let textDiff =
    "\x1B[1mcollections.fsl\x1B[22m\n" +
    "\x1B[36m@ line 1 to 7\x1B[0m\n" +
    "\n" +
    "\x1B[32m+ collection NewCollection {\x1B[0m\n" +
    "\x1B[32m+ }\x1B[0m\n" +
    "\x1B[32m+\x1B[0m\n" +
    "  collection Customer {\n" +
    "    name: String\n" +
    "    email: String\n" +
    "\x1B[36m@ line 134 to 139\x1B[0m\n" +
    "      terms [.order]\n" +
    "      values [.product, .quantity]\n" +
    "    }\n" +
    "\x1B[31m-\x1B[0m\n" +
    "\x1B[31m-   index byOrderAndProduct {\x1B[0m\n" +
    "\x1B[31m-     terms [.order, .product]\x1B[0m\n" +
    "\x1B[31m-   }\x1B[0m\n" +
    "  }\n" +
    "\n" +
    "\n" +
    "\n" +
    "\x1B[1mfunctions.fsl\x1B[22m\n" +
    "\x1B[36m@ line 30 to 35\x1B[0m\n" +
    "    if (product!.stock < quantity) {\n" +
    '      abort("Product does not have the requested quantity in stock.")\n' +
    "    }\n" +
    "\x1B[31m-\x1B[0m\n" +
    "\x1B[31m-   // Attempt to find an existing order item for the order, product pair.\x1B[0m\n" +
    "\x1B[31m-   // There is a unique constraint on [.order, .product] so this will return at most one result.\x1B[0m\n" +
    "\x1B[31m-   let orderItem = OrderItem.byOrderAndProduct(customer!.cart, product).first()\x1B[0m\n" +
    "\x1B[31m-\x1B[0m\n" +
    "\x1B[31m-   if (orderItem == null) {\x1B[0m\n" +
    "\x1B[31m-     // If the order item does not exist, create a new one.\x1B[0m\n" +
    "\x1B[31m-     OrderItem.create({\x1B[0m\n" +
    "\x1B[31m-       order: Order(customer!.cart!.id),\x1B[0m\n" +
    "\x1B[31m-       product: product,\x1B[0m\n" +
    "\x1B[31m-       quantity: quantity,\x1B[0m\n" +
    "\x1B[31m-     })\x1B[0m\n" +
    "\x1B[31m-   } else {\x1B[0m\n" +
    "\x1B[31m-     // If the order item exists, update the quantity.\x1B[0m\n" +
    "\x1B[31m-     orderItem!.update({ quantity: quantity })\x1B[0m\n" +
    "\x1B[31m-   }\x1B[0m\n" +
    "  }\n" +
    "\n" +
    "  function getOrCreateCart(id) {\n";

  beforeEach(() => {
    container = setupContainer();
    fetch = container.resolve("fetch");
    logger = container.resolve("logger");
    gatherFSL = container.resolve("gatherFSL");
  });

  it("notifies the user when no local schema is found", async function () {
    gatherFSL.resolves([]);
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
    expect(fetch).not.to.have.been.calledWith(
      buildUrl("/schema/1/validate", {
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
      sinon.match(/^Local changes: .*no schema files found in.*\n$/),
    );
  });

  it("fetches the current status when there are no changes", async function () {
    gatherFSL.resolves(fsl);
    fetch.onCall(0).resolves(
      f({
        version: 0,
        status: "none",
        diff: "Staged schema: none",
        pending_summary: "",
        text_diff: "",
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
      { ...commonFetchParams, method: "POST", body: reformatFSL(fsl) },
    );
    expect(logger.stdout).to.have.been.calledWith(
      `Staged changes: ${chalk.bold("none")}`,
    );
    expect(logger.stdout).to.have.been.calledWith(
      `Local changes: ${chalk.bold("none")}\n`,
    );
  });

  it("fetches the current status when there are only local changes", async function () {
    gatherFSL.resolves(fsl);
    fetch.onCall(0).resolves(
      f({
        version: 0,
        status: "none",
        diff: "Staged schema: none",
        pending_summary: "",
        text_diff: "",
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
      { ...commonFetchParams, method: "POST", body: reformatFSL(fsl) },
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
    gatherFSL.resolves(fsl);
    fetch.onCall(0).resolves(
      f({
        version: 0,
        status: "ready",
        diff: summaryDiff,
        pending_summary: "",
        text_diff: textDiff,
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
      { ...commonFetchParams, method: "POST", body: reformatFSL(fsl) },
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
    gatherFSL.resolves(fsl);
    fetch.onCall(0).resolves(
      f({
        version: 0,
        status: "ready",
        diff: summaryDiff,
        pending_summary: "",
        text_diff: "",
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
      { ...commonFetchParams, method: "POST", body: reformatFSL(fsl) },
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
    fetch.callsFake(() =>
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

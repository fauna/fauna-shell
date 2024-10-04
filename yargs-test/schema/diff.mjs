import { expect } from "chai";

import * as awilix from "awilix/lib/awilix.module.mjs";

import { f, commonFetchParams } from "../helpers.mjs";

import { run } from "../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../src/config/setup-test-container.mjs";

import { makeFaunaRequest } from "../../src/lib/db.mjs";

describe("schema diff", function () {
  const colorDiffString =
    "\u001B[1;34m* Removing collection `Todo`\u001B[0m from main.fsl:8:1:\n\n\u001B[31m  - collection Todo {\u001B[0m\n\u001B[31m  -   history_days 0\u001B[0m\n\u001B[31m  - }\u001B[0m\n\n";
  const noColorDiffString =
    "* Removing collection `Todo` from main.fsl:8:1:\n\n  - collection Todo {\n  -   history_days 0\n  - }\n\n";
  let container;
  let logger;

  beforeEach(() => {
    container = setupContainer();
    container.register({
      makeFaunaRequest: awilix.asValue(makeFaunaRequest),
    });
    logger = container.resolve("logger");
  });

  it("can display the diff between local and remote schema", async function () {
    const fetch = container.resolve("fetch");

    fetch.resolves(
      f({
        version: 0,
        diff: colorDiffString,
      })
    );

    await run(`schema diff --secret "secret"`, container);

    expect(fetch).to.have.been.calledWith(
      "https://db.fauna.com/schema/1/validate?force=true&color=ansii&staged=false",
      { ...commonFetchParams, method: "POST" }
    );
    expect(logger.stdout).to.have.been.calledWith(colorDiffString);
    expect(logger.stderr).to.not.have.been.called;
  });

  it("can display the diff between local and staged remote schema", async function () {
    const fetch = container.resolve("fetch");

    fetch.resolves(
      f({
        version: 0,
        diff: colorDiffString,
      })
    );

    await run(`schema diff --staged --secret "secret"`, container);

    expect(fetch).to.have.been.calledWith(
      "https://db.fauna.com/schema/1/validate?force=true&color=ansii&staged=true",
      { ...commonFetchParams, method: "POST" }
    );
    expect(logger.stdout).to.have.been.calledWith(colorDiffString);
    expect(logger.stderr).to.not.have.been.called;
  });

  it("can display the diff without color (terminal escape codes)", async function () {
    const fetch = container.resolve("fetch");

    fetch.resolves(
      f({
        version: 0,
        diff: noColorDiffString,
      })
    );

    await run(`schema diff --secret "secret" --no-color`, container);

    expect(fetch).to.have.been.calledWith(
      "https://db.fauna.com/schema/1/validate?force=true&staged=false",
      { ...commonFetchParams, method: "POST" }
    );
    expect(logger.stdout).to.have.been.calledWith(noColorDiffString);
    expect(logger.stderr).to.not.have.been.called;
  });

  it("displays useful output when a diff is empty", async function () {
    const fetch = container.resolve("fetch");

    fetch.resolves(
      f({
        version: 0,
        diff: "",
      })
    );

    await run(`schema diff --secret "secret"`, container);

    expect(fetch).to.have.been.calledWith(
      "https://db.fauna.com/schema/1/validate?force=true&color=ansii&staged=false",
      { ...commonFetchParams, method: "POST" }
    );
    expect(logger.stdout).to.have.been.calledWith("No schema differences");
    expect(logger.stderr).to.not.have.been.called;
  });
});

import { expect } from "chai";

import { run } from "../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../src/config/setup-test-container.mjs";
import { commonFetchParams, f } from "../helpers.mjs";

describe("schema status", function () {
  let container;

  beforeEach(() => {
    container = setupContainer();
  });

  it("fetches the current status", async function () {
    const fetch = container.resolve("fetch");
    fetch.resolves(
      f({
        version: 0,
        status: "none",
        diff: "Staged schema: none",
      }),
    );
    await run(`schema status --secret "secret"`, container);

    expect(fetch).to.have.been.calledWith(
      "https://db.fauna.com/schema/1/staged/status?diff=true&color=ansi",
      commonFetchParams,
    );
  });

  it("can fetch status without embedded colors (terminal escape codes)", async function () {
    const fetch = container.resolve("fetch");
    fetch.resolves(
      f({
        version: 0,
        status: "none",
        diff: "Staged schema: none",
      }),
    );
    await run(`schema status --no-color --secret "secret"`, container);

    expect(fetch).to.have.been.calledWith(
      "https://db.fauna.com/schema/1/staged/status?diff=true",
      commonFetchParams,
    );
  });
});

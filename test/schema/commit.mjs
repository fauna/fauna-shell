// import { expect } from "chai";

// import * as awilix from "awilix";

// import { f } from "../helpers.mjs";

// import { run } from "../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../src/config/setup-test-container.mjs";

describe("schema commit", function () {
  let container;

  beforeEach(() => {
    container = setupContainer();
    container.resolve("fetch");
  });

  it.skip("can commit a schema change", async function () {});

  it.skip("can force commit a schema change", async function () {});

  it.skip("warns if there is no staged schema change", async function () {});

  it.skip("warns if the schema is not in a ready state", async function () {});

  it.skip("can be cancelled without making mutating network calls", async function () {});
});

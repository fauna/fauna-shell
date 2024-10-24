import { expect } from "chai";

import { run } from "../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../src/config/setup-test-container.mjs";

describe("eval", function () {
  let container;

  beforeEach(() => {
    container = setupContainer();
  });

  describe("common", function () {
    it.skip('can output results in "json" format', async function () {});

    it.skip('can output results in "json-tagged" format', async function () {});

    it.skip('can output results in "shell" format', async function () {});

    it.skip("can output results to a file", async function () {});

    it.skip("can read input from stdin", async function () {});

    it.skip("can read input from a file", async function () {});

    it.skip("can set a connection timeout", async function () {});
  });

  describe("v10", function () {
    it("can eval a query", async function () {
      const logger = container.resolve("logger");
      container.resolve("performQuery").resolves({
        data: [
          {
            name: "v4-test",
            coll: "Database",
            ts: 'Time("2024-07-16T19:16:15.980Z")',
            global_id: "asd7zi8pharfn",
          },
        ],
      });

      await run(`eval --secret "secret" --query "Database.all()"`, container);

      expect(logger.stdout).to.have.been.calledWith({
        data: [
          {
            name: "v4-test",
            coll: "Database",
            ts: 'Time("2024-07-16T19:16:15.980Z")',
            global_id: "asd7zi8pharfn",
          },
        ],
      });
      expect(logger.stderr).to.not.be.called;
    });

    it.skip("can eval a query with typechecking enabled", async function () {});
  });

  describe("v4", function () {
    it.skip("can eval a query", async function () {});
  });
});

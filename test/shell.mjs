//@ts-check

import { EOL } from "node:os";
import util from "node:util";

import { expect } from "chai";

import { run } from "../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../src/config/setup-test-container.mjs";

describe("shell", function () {
  let container;
  let prompt = `${EOL}\x1B[1G\x1B[0J> \x1B[3G`;

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
    it("can open a shell and run a query", async function () {
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

      const stdin = container.resolve("stdinStream");
      const logger = container.resolve("logger");
      const runPromise = run(`shell --secret "secret" --no-color`, container);

      stdin.push(`Database.all()${EOL}`);
      stdin.push(null);

      await runPromise;
      const stringifiedObj = util.inspect({
        data: [
          {
            name: "v4-test",
            coll: "Database",
            ts: 'Time("2024-07-16T19:16:15.980Z")',
            global_id: "asd7zi8pharfn",
          },
        ],
      });

      expect(container.resolve("stdoutStream").getWritten()).to.equal(
        `Type Ctrl+D or .exit to exit the shell${prompt}Database.all()\r${EOL}${stringifiedObj}${prompt}`,
      );
      expect(logger.stderr).to.not.be.called;
    });

    it.skip("can eval a query with typechecking enabled", async function () {});
  });

  describe("v4", function () {
    it.skip("can eval a query", async function () {});
  });
});

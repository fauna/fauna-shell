//@ts-check

import { EOL } from "node:os";

import { expect } from "chai";

import { run } from "../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../src/config/setup-test-container.mjs";

// this is defined up here so the indentation doesn't make it harder to use :(
const v10Object1 = `{
  data: [
    {
      name: "v4-test",
      coll: Database,
      ts: Time("2024-07-16T19:16:15.980Z"),
      global_id: "asd7zi8pharfn",
    },
  ],
}`;

const v10Object2 = `{
  data: [
    {
      name: "alpacas",
      coll: Database,
      ts: Time("2024-07-16T19:16:15.980Z"),
      global_id: "msdmkl82h8rwo",
    },
  ],
}`;

const v4Object1 = `{
  data: [
    Database("v4-test")
  ]
}`;

const v4Object2 = `{
  data: [
    Database("alpacas")
  ]
}`;

describe("shell", function () {
  let container, stdin, stdout, logger;
  let prompt = `${EOL}> `;

  beforeEach(() => {
    container = setupContainer();
    stdin = container.resolve("stdinStream");
    stdout = container.resolve("stdoutStream");
    logger = container.resolve("logger");
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
    it("can open a shell and run several queries", async function () {
      container.resolve("performV10Query").resolves(v10Object1);

      // start the shell
      const runPromise = run(`shell --secret "secret"`, container);

      // send our first command
      stdin.push("Database.all().take(1)\n");
      await stdout.waitForWritten();

      // validate
      expect(stdout.getWritten()).to.equal(
        `Type Ctrl+D or .exit to exit the shell${prompt}${v10Object1}\n> `,
      );
      expect(logger.stderr).to.not.be.called;

      // reset
      stdout.clear();
      container.resolve("performV10Query").resolves(v10Object2);

      // send our second command
      stdin.push(`Database.all().drop(1).take(1)`);
      stdin.push(null); // terminate the shell
      await stdout.waitForWritten();

      // validate second object
      expect(stdout.getWritten()).to.equal(`${v10Object2}${prompt}`);
      expect(logger.stderr).to.not.be.called;

      return runPromise;
    });

    it.skip("can eval a query with typechecking enabled", async function () {});
  });

  describe("v4", function () {
    it("can open a shell and run a query", async function () {
      container.resolve("performV4Query").resolves(v4Object1);

      // start the shell
      const runPromise = run(`shell --secret "secret" --version 4`, container);

      // send our first command
      stdin.push("Database.all().take(1)\n");
      await stdout.waitForWritten();

      // validate
      expect(stdout.getWritten()).to.equal(
        `Type Ctrl+D or .exit to exit the shell${prompt}${v4Object1}\n> `,
      );
      expect(logger.stderr).to.not.be.called;

      // reset
      stdout.clear();
      container.resolve("performV4Query").resolves(v4Object2);

      // send our second command
      stdin.push(`Database.all().drop(1).take(1)`);
      stdin.push(null); // terminate the shell
      await stdout.waitForWritten();

      // validate second object
      expect(stdout.getWritten()).to.equal(`${v4Object2}${prompt}`);
      expect(logger.stderr).to.not.be.called;

      return runPromise;
    });
  });
});

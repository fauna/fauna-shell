//@ts-check

import { EOL } from "node:os";

import { expect } from "chai";
import sinon from "sinon";

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
  let prompt = `${EOL}\x1B[1G\x1B[0J> \x1B[3G`;

  beforeEach(() => {
    container = setupContainer();
    stdin = container.resolve("stdinStream");
    stdout = container.resolve("stdoutStream");
    logger = container.resolve("logger");
  });

  describe("common", function () {
    it('outputs results in "shell" format by default', async function () {
      container.resolve("performV10Query").resolves(v10Object1);
      let query = "Database.all().take(1)";

      // start the shell
      const runPromise = run(`shell --secret "secret" --typecheck`, container);

      // send one command
      stdin.push(`${query}\n`);
      stdin.push(null);
      await stdout.waitForWritten();
      await runPromise;

      expect(container.resolve("performV10Query")).to.have.been.calledWith(
        sinon.match.any,
        sinon.match(query),
        undefined,
        // the "shell" CLI format gets renamed by performV10Query to "decorated"
        // before being sent to the API
        sinon.match({ version: "10", format: "shell" }),
      );
    });

    it.skip('can output results in "json" format', async function () {});

    it.skip('can output results in "json-tagged" format', async function () {});

    it.skip("can output results to a file", async function () {});

    it.skip("can read input from stdin", async function () {});

    it.skip("can read input from a file", async function () {});

    it.skip("can set a connection timeout", async function () {});
  });

  describe("v10", function () {
    it("can open a shell and run several queries", async function () {
      container.resolve("performV10Query").resolves(v10Object1);
      let query = "Database.all().take(1)";

      // start the shell
      const runPromise = run(`shell --secret "secret"`, container);
      // Wait for the shell to start (print ">")
      await stdout.waitForWritten();
      // send our first command
      stdin.push(`${query}\n`);
      await stdout.waitForWritten();

      // validate
      expect(stdout.getWritten()).to.equal(
        `Type Ctrl+D or .exit to exit the shell${prompt}${query}\r\n${v10Object1}${prompt}`,
      );
      expect(logger.stderr).to.not.be.called;

      // reset
      stdout.clear();
      container.resolve("performV10Query").resolves(v10Object2);

      // send our second command
      query = "Database.all().take(1)";
      stdin.push(`${query}\n`);
      stdin.push(null); // terminate the shell
      await stdout.waitForWritten();

      // validate second object
      expect(stdout.getWritten()).to.equal(
        `${query}\r\n${v10Object2}${prompt}`,
      );
      expect(logger.stderr).to.not.be.called;

      return runPromise;
    });

    it("can eval a query with typechecking enabled", async function () {
      container.resolve("performV10Query").resolves(v10Object1);
      let query = "Database.all().take(1)";

      // start the shell
      const runPromise = run(`shell --secret "secret" --typecheck`, container);

      // send one command
      stdin.push(`${query}\n`);
      stdin.push(null);
      await stdout.waitForWritten();
      await runPromise;

      expect(container.resolve("performV10Query")).to.have.been.calledWith(
        sinon.match.any,
        sinon.match(query),
        undefined,
        sinon.match({ version: "10", typecheck: true }),
      );
    });

    describe("error handling", function () {
      it.skip("can handle a client-side query syntax error", async function () {});
      it.skip("can handle a server-side query syntax error", async function () {});
      it.skip("can handle a UDF abort", async function () {});
      it.skip("can handle a query limit exceeded error", async function () {});
      it.skip("can handle a query rate limit error", async function () {});
      it.skip("can handle a server-side query timeout", async function () {});
      it.skip("can handle a client-side query timeout", async function () {});
    });
  });

  describe("v4", function () {
    it("can open a shell and run several queries", async function () {
      container.resolve("performV4Query").resolves(v4Object1);
      let query = "Select(0, Paginate(Databases()))";

      // start the shell
      const runPromise = run(`shell --secret "secret" --version 4`, container);
      // Wait for the shell to start (print ">")
      await stdout.waitForWritten();
      // send our first command
      stdin.push(`${query}\n`);
      await stdout.waitForWritten();

      // validate
      expect(stdout.getWritten()).to.equal(
        `Type Ctrl+D or .exit to exit the shell${prompt}${query}\r\n${v4Object1}${prompt}`,
      );
      expect(logger.stderr).to.not.be.called;

      // reset
      stdout.clear();
      container.resolve("performV4Query").resolves(v4Object2);

      // send our second command
      query = "Select(1, Paginate(Databases()))";
      stdin.push(`${query}\n`);
      stdin.push(null); // terminate the shell
      await stdout.waitForWritten();

      // validate second object
      expect(stdout.getWritten()).to.equal(`${query}\r\n${v4Object2}${prompt}`);
      expect(logger.stderr).to.not.be.called;

      return runPromise;
    });

    describe("error handling", function () {
      it.skip("can handle a client-side query syntax error", async function () {});
      it.skip("can handle a server-side query syntax error", async function () {});
      it.skip("can handle a UDF abort", async function () {});
      it.skip("can handle a query limit exceeded error", async function () {});
      it.skip("can handle a query rate limit error", async function () {});
      it.skip("can handle a server-side query timeout", async function () {});
      it.skip("can handle a client-side query timeout", async function () {});
    });
  });
});

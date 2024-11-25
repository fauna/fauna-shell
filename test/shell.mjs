
//@ts-check
import node_fs from "node:fs";
import { EOL } from "node:os";
import path from "node:path";

import * as awilix from "awilix";
import { expect } from "chai";
import sinon from "sinon";

import { run } from "../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../src/config/setup-test-container.mjs";
import { createV4QuerySuccess, createV10QuerySuccess } from "./helpers.mjs";

// this is defined up here so the indentation doesn't make it harder to use :(
const v10Object1 = createV10QuerySuccess({
  data: [
    {
      name: "v4-test",
      coll: "Database",
      ts: "2024-07-16T19:16:15.980Z",
      global_id: "asd7zi8pharfn",
    },
  ]
});

const v10Object2 = createV10QuerySuccess({
  name: "alpacas",
  coll: "Database",
  ts: "2024-07-16T19:16:15.980Z",
  global_id: "msdmkl82h8rwo",
});

const v4Object1 = createV4QuerySuccess({
  "@ref": {
    "id": "test",
    "collection": {
      "@ref": {
        "id": "collections"
      }
    }
  }
});

const v4Object2 = createV4QuerySuccess({
  "@ref": {
    "id": "alpacas",
    "collection": {
      "@ref": {
        "id": "collections"
      }
    }
  }
});

describe("shell", function () {
  let container, stdin, stdout, logger, runQueryFromString;

  const promptReset = "\x1B[1G\x1B[0J> ";
  const prompt = `${EOL}${promptReset}\x1B[3G`;
  const getHistoryPrompt = (text) => `${promptReset}${text}\u001b[${3 + text.length}G`

  beforeEach(() => {
    container = setupContainer();
    container.register({
      fs: awilix.asValue(node_fs)
    });
    stdin = container.resolve("stdinStream");
    stdout = container.resolve("stdoutStream");
    logger = container.resolve("logger");
    runQueryFromString = container.resolve("runQueryFromString");
  });

  describe("common", function () {
    it.skip("can output results to a file", async function () {});

    it.skip("can read input from stdin", async function () {});

    it.skip("can read input from a file", async function () {});

    it.skip("can set a connection timeout", async function () {});

    const upArrow = "\x1b[A";
    const downArrow = "\x1b[B";

    it("can keep track of history", async function () {
      // start the shell
      const runPromise = run(`shell --secret "secret" --typecheck`, container);

      // send our first command
      stdin.push(`1\n2\n3\n`);
      await stdout.waitForWritten();

      // navigate up through history
      stdout.clear();
      stdin.push(upArrow);
      await stdout.waitForWritten();
      expect(stdout.getWritten()).to.equal(getHistoryPrompt("3"));
      stdout.clear();
      stdin.push(upArrow);
      await stdout.waitForWritten();
      expect(stdout.getWritten()).to.equal(getHistoryPrompt("2"));
      stdout.clear();
      stdin.push(upArrow);
      await stdout.waitForWritten();
      expect(stdout.getWritten()).to.equal(getHistoryPrompt("1"));
      stdout.clear();
      stdin.push(downArrow);
      await stdout.waitForWritten();
      expect(stdout.getWritten()).to.equal(getHistoryPrompt("2"));
      stdout.clear();
      stdin.push(downArrow);
      await stdout.waitForWritten();
      expect(stdout.getWritten()).to.equal(getHistoryPrompt("3"));

      expect(container.resolve("stderrStream").getWritten()).to.equal("");

      stdin.push(null);

      return runPromise;
    });

    it.skip("can clear history", async function () {});

    it.skip("can save history between sessions", async function () {});
  });

  describe("v10", function () {
    it.skip("can open a shell and run several queries", async function () {
      runQueryFromString.resolves(v10Object1);
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
        `Type Ctrl+D or .exit to exit the shell${prompt}${query}\r\n${JSON.stringify(v10Object1.data, null, 2)}${prompt}`,
      );
      expect(logger.stderr).to.not.be.called;

      // reset
      stdout.clear();
      runQueryFromString.resolves(v10Object2);

      // send our second command
      query = "Database.all().take(1)";
      stdin.push(`${query}\n`);
      stdin.push(null); // terminate the shell
      await stdout.waitForWritten();

      // validate second object
      expect(stdout.getWritten()).to.equal(
        `${query}\r\n${JSON.stringify(v10Object2.data, null, 2)}${prompt}`,
      );
      expect(logger.stderr).to.not.be.called;

      return runPromise;
    });

    it.skip("can eval a query with typechecking enabled", async function () {
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
    it.skip("can open a shell and run several queries", async function () {
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

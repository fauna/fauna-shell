//@ts-check

import node_fs from "node:fs";
import { EOL } from "node:os";
import path from "node:path";

import * as awilix from "awilix";
import { expect } from "chai";
import { NetworkError } from "fauna";
import sinon, { stub } from "sinon";

import { run } from "../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../src/config/setup-test-container.mjs";
import {
  NETWORK_ERROR_MESSAGE,
  ValidationError,
} from "../../src/lib/errors.mjs";
import { isQueryable } from "../../src/lib/fauna-client.mjs";
import { dirExists } from "../../src/lib/file-util.mjs";
import { colorize } from "../../src/lib/formatting/colorize.mjs";
import { createV4QuerySuccess, createV10QuerySuccess } from "../helpers.mjs";

// this is defined up here so the indentation doesn't make it harder to use :(
const v10Object1 = createV10QuerySuccess({
  data: [
    {
      name: "v4-test",
      coll: "Database",
      ts: "2024-07-16T19:16:15.980Z",
      global_id: "asd7zi8pharfn",
    },
  ],
});

const v10Object2 = createV10QuerySuccess({
  name: "alpacas",
  coll: "Database",
  ts: "2024-07-16T19:16:15.980Z",
  global_id: "msdmkl82h8rwo",
});

const v4Object1 = createV4QuerySuccess({
  "@ref": {
    id: "test",
    collection: {
      "@ref": {
        id: "collections",
      },
    },
  },
});

const v4Object2 = createV4QuerySuccess({
  "@ref": {
    id: "alpacas",
    collection: {
      "@ref": {
        id: "collections",
      },
    },
  },
});

const sleep = async (ms) =>
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

describe("shell", function () {
  let container, stdin, stdout, stderr, logger, runQueryFromString;

  const promptReset = "\x1B[1G\x1B[0J> ";
  const prompt = `${EOL}${promptReset}\x1B[3G`;
  const getHistoryPrompt = (text) =>
    `${promptReset}${text}\u001b[${3 + text.length}G`;

  beforeEach(() => {
    container = setupContainer();

    // we need to use the actual node fs, not the mock
    container.register({
      fs: awilix.asValue(node_fs),
    });

    logger = container.resolve("logger");
    stdin = container.resolve("stdinStream");
    stdout = container.resolve("stdoutStream");
    stderr = container.resolve("stderrStream");
    runQueryFromString = container.resolve("runQueryFromString");
  });

  describe("common", function () {
    it.skip("can output results to a file", async function () {});

    it.skip("can read input from stdin", async function () {});

    it.skip("can read input from a file", async function () {});

    it.skip("can set a connection timeout", async function () {});

    it("can fail before getting to shell if the database is not queryable", async function () {
      container
        .resolve("isQueryable")
        .rejects(new ValidationError("Database not found: us/bad"));
      const runPromise = run(`shell --format json -d us/bad`, container);

      try {
        await runPromise;
      } catch {}

      await stderr.waitForWritten();
      expect(stderr.getWritten()).to.match(/Database not found: us\/bad/);
    });

    it("can handle network errors", async function () {
      runQueryFromString.rejects(new NetworkError("test error", { cause: {} }));
      container.register({
        isQueryable: awilix.asValue(isQueryable),
      });
      const runPromise = run(`shell --format json -d us/bad`, container);

      try {
        await runPromise;
      } catch {}

      await stderr.waitForWritten();

      expect(stderr.getWritten()).to.contain(NETWORK_ERROR_MESSAGE);
      expect(stderr.getWritten()).to.not.contain("failed unexpectedly");
    });

    describe("history", function () {
      const upArrow = "\x1b[A";
      const downArrow = "\x1b[B";

      const registerHomedir = (container, subdir = "") => {
        const __dirname = import.meta.dirname;
        const homedir = path.join(__dirname, "../../test/test-homedir", subdir);

        container.register({
          homedir: awilix.asValue(stub().returns(homedir)),
        });
      };

      it("can be navigated through", async function () {
        registerHomedir(container, "track-history");

        // start the shell
        const runPromise = run(
          `shell --secret "secret" --format json --no-color`,
          container,
        );
        // Wait for the shell to start (print ">")
        // sleep for a little bit to let the shell get started
        // for some reason this is needed for the stdout to be read from predictably
        await sleep(50);
        await stdout.waitForWritten();

        // send our first command
        stdin.push(`1\n2\n3\n`);
        await sleep(50);
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

      it("can be cleared", async function () {
        registerHomedir(container, "clear-history");

        // start the shell
        const runPromise = run(
          `shell --secret "secret" --no-color --format json`,
          container,
        );
        // Wait for the shell to start (print ">")
        // sleep for a little bit to let the shell get started
        // for some reason this is needed for the stdout to be read from predictably
        await sleep(50);
        await stdout.waitForWritten();

        // send our first command
        stdin.push("4\n5\n6\n");
        await sleep(50);
        await stdout.waitForWritten();

        const command = ".clearhistory";
        const expected = `${command}\r\nHistory cleared${prompt}`;

        // confirm feedback that .clearhistory command was run
        stdout.clear();
        stdin.push(`${command}\n`);
        await sleep(50);
        await stdout.waitForWritten();
        expect(stdout.getWritten()).to.equal(expected);

        // sleep to allow time for history to be cleared
        await sleep(100);

        // Confirm that history is indeed cleared
        // When there is no history to flip thorugh, stdout will not be written
        // to. Allow some time for stdout to change to catch issues where stdout
        // is written to.
        stdin.push(upArrow);
        await Promise.any([stdout.waitForWritten(), sleep(100)]);
        expect(stdout.getWritten()).to.equal(expected);

        expect(container.resolve("stderrStream").getWritten()).to.equal("");

        stdin.push(null);

        return runPromise;
      });

      it("can be persisted between sessions", async function () {
        registerHomedir(container, "persist-history");

        // create history file
        // NOTE: this would be more precise if we could run multiple shell
        // sessions, but there are complications trying to reset stdin after
        // pushing null.
        const fs = container.resolve("fs");
        const homedir = container.resolve("homedir")();
        if (!dirExists(path.join(homedir, ".fauna"))) {
          fs.mkdirSync(path.join(homedir, ".fauna"), { recursive: true });
        }
        fs.writeFileSync(path.join(homedir, ".fauna/history"), "9\n8\n7\n");

        // start the shell
        const runPromise = run(
          `shell --secret "secret" --format json --no-color`,
          container,
        );
        // Wait for the shell to start (print ">")
        // sleep for a little bit to let the shell get started
        // for some reason this is needed for the stdout to be read from predictably
        await sleep(50);
        await stdout.waitForWritten();

        // navigate up through history
        await stdout.waitForWritten();
        stdout.clear();
        stdin.push(upArrow);
        await stdout.waitForWritten();
        expect(stdout.getWritten()).to.equal(getHistoryPrompt("9"));
        stdout.clear();
        stdin.push(upArrow);
        await stdout.waitForWritten();
        expect(stdout.getWritten()).to.equal(getHistoryPrompt("8"));
        stdout.clear();
        stdin.push(upArrow);
        await stdout.waitForWritten();
        expect(stdout.getWritten()).to.equal(getHistoryPrompt("7"));

        expect(container.resolve("stderrStream").getWritten()).to.equal("");

        stdin.push(null);

        return runPromise;
      });
    });
  });

  describe("v10", function () {
    it("can open a shell and run several queries", async function () {
      runQueryFromString.resolves(v10Object1);
      let query = "Database.all().take(1)";

      // start the shell
      const runPromise = run(
        `shell --secret "secret" --no-color --format json`,
        container,
      );
      // Wait for the shell to start (print ">")
      // sleep for a little bit to let the shell get started
      // for some reason this is needed for the stdout to be read from predictably
      await sleep(50);
      await stdout.waitForWritten();

      // send our first command
      stdin.push(`${query}\n`);
      await sleep(50);
      await stdout.waitForWritten();

      // validate
      expect(stdout.getWritten()).to.equal(
        `Type Ctrl+D or .exit to exit the shell${prompt}${query}\r\n${colorize(v10Object1.data, { format: "json", color: false })}${prompt}`,
      );
      expect(logger.stderr).to.not.be.called;

      // reset
      stdout.clear();
      runQueryFromString.resolves(v10Object2);

      // send our second command
      query = "Database.all().take(1)";
      stdin.push(`${query}\n`);
      stdin.push(null); // terminate the shell
      await sleep(50);
      await stdout.waitForWritten();

      // validate second object
      expect(stdout.getWritten()).to.equal(
        `${query}\r\n${colorize(v10Object2.data, {
          format: "json",
          color: false,
        })}${prompt}`,
      );
      expect(logger.stderr).to.not.be.called;

      return runPromise;
    });

    it.skip("does not colorize output if --no-color is used", async function () {});

    it("can open a shell and run several queries with options", async function () {
      runQueryFromString.resolves(v10Object1);
      let query = "Database.all().take(1)";

      const runPromise = run(
        "shell --secret=foo --typecheck --performance-hints --max-attempts 5 --max-backoff 2000 --timeout 10000",
        container,
      );

      await sleep(50);
      await stdout.waitForWritten();

      stdin.push(`Database.all().take(1)\n`);
      stdin.push(null);
      await sleep(50);
      await stdout.waitForWritten();

      expect(runQueryFromString).to.have.been.calledWith(
        sinon.match(query),
        sinon.match({
          timeout: 10000,
          typecheck: true,
          performanceHints: true,
          maxAttempts: 5,
          maxBackoff: 2000,
        }),
      );

      return runPromise;
    });

    it("can display performance hints", async function () {
      runQueryFromString.resolves({
        summary:
          "performance_hint: use a more efficient query\n1 | use a more efficient query",
        data: "fql",
      });

      const runPromise = run(
        `shell --secret "secret" --performance-hints --no-color --format json`,
        container,
      );

      await sleep(50);
      await stdout.waitForWritten();

      stdin.push(`Database.all().take(1)\n`);
      stdin.push(null);
      await sleep(50);
      await stdout.waitForWritten();

      expect(stdout.getWritten()).to.match(/use a more efficient query/);

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

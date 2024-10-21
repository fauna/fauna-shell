import * as fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect } from "chai";
import { stub } from "sinon";
import * as awilix from "awilix";

import { run, builtYargs } from "../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../src/config/setup-test-container.mjs";
import chalk from "chalk";

describe("cli operations", function () {
  let container;

  beforeEach(() => {
    container = setupContainer();
  });

  it("should exit with a helpful message if a flag is not provided", async function () {
    const logger = container.resolve("logger");

    // this is missing the --secret flag
    try {
      await run(`schema pull`, container);
    } catch (e) {}

    expect(logger.stdout).to.not.be.called;
    const message = `${chalk.reset(await builtYargs.getHelp())}\n\n${chalk.red(
      "Missing required argument: secret",
    )}`;
    expect(logger.stderr).to.have.been.calledWith(message);
    expect(container.resolve("parseYargs")).to.have.been.calledOnce;
  });

  // TODO: this doesn't work because turning on strict mode breaks parsing sub-commands. why?
  it("should exit with a helpful message if a non-existant command is provided", async function () {
    const logger = container.resolve("logger");

    // this command does not exist
    try {
      await run(`inland-empire`, container);
    } catch (e) {}

    expect(logger.stdout).to.not.be.called;
    const message = `${chalk.reset(await builtYargs.getHelp())}\n\n${chalk.red(
      "Unknown argument: inland-empire",
    )}`;
    expect(logger.stderr).to.have.been.calledWith(message);
    expect(container.resolve("parseYargs")).to.have.been.calledOnce;
  });

  it("should exit with a helpful message if the handler throws", async function () {
    const logger = container.resolve("logger");

    // this hidden command's handler always throws
    try {
      await run(`throw`, container);
    } catch (e) {}

    expect(logger.stdout).to.not.be.called;
    const message = `${chalk.reset(await builtYargs.getHelp())}\n\n${chalk.red(
      "this is a test error",
    )}`;
    expect(logger.stderr).to.have.been.calledWith(message);
    expect(container.resolve("parseYargs")).to.have.been.calledOnce;
  });

  it("should exit with a helpful message if the handler returns a rejected promise", async function () {
    const logger = container.resolve("logger");

    // this hidden command's handler always returns a rejected promise
    try {
      await run(`reject`, container);
    } catch (e) {}

    expect(logger.stdout).to.not.be.called;
    const message = `${chalk.reset(await builtYargs.getHelp())}\n\n${chalk.red(
      "this is a rejected promise",
    )}`;
    expect(logger.stderr).to.have.been.calledWith(message);
    expect(container.resolve("parseYargs")).to.have.been.calledOnce;
  });

  it("should check for updates when run", async function () {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const packagePath = path.join(__dirname, "../package.json");

    const packageJson = JSON.parse(
      fs.readFileSync(packagePath, {
        encoding: "utf-8",
      }),
    );
    const notify = stub();
    const updateNotifier = stub().returns({ notify });
    container.register({ updateNotifier: awilix.asValue(updateNotifier) });

    await run(`schema status --secret "secret"`, container);

    expect(updateNotifier).to.have.been.calledWith({
      pkg: packageJson,
      updateCheckInterval: 1000 * 60 * 60 * 24 * 7, // 1 week
    })
    expect(notify).to.have.been.called;
  });

  it.skip("should detect color support if the user does not specify", async function () {
    // i can't find a way to mock this that doesn't involve setting a flag
    // and setting a flag defeats the purpose of testing if it's _detected_ automatically
    // skipping for now
  });

  it.skip("should only ever parse args once", async function () {
    // for now, this is mostly taken care of by the tests above, which set assert that
    // parseYargs was only called once in their respective error cases
  });
});

//@ts-check

import { expect } from "chai";
import sinon from "sinon";

import { run } from "../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../src/config/setup-test-container.mjs";

describe("key create", () => {
  let container, /*fs,*/ logger;

  beforeEach(() => {
    // reset the container before each test
    container = setupContainer();
    // fs = container.resolve("fs");
    logger = container.resolve("logger");
  });

  async function runCommand(command) {
    return run(command, container);
  }

  [
    {
      command: "key create --keyRole admin",
      expected: "You must provide at least one of: --database, --secret, --local.",
    },
    {
      command: "key create --database us-std",
      expected: "Missing required argument: keyRole",
    },
    {
      command: "key create --database us-std --ttl taco --keyRole admin",
      expected: "Invalid ttl 'taco'. Provide as an ISO 8601 date time string.",
    },
  ].forEach(({ command, expected }) => {
    it("Provides clear error when invalid args are provided", async () => {
      try {
        await runCommand(command);
      } catch (e) {}

      expect(logger.stderr).to.have.been.calledWith(sinon.match(expected));
      expect(container.resolve("parseYargs")).to.have.been.calledOnce;
    });
  });

  describe("using --secret", () => {
    it("Prints out a TODO", async () => {
      await runCommand("key create --secret secret --keyRole admin");
      expect(logger.stderr).to.have.been.calledWith(sinon.match("TODO"));
    });
  });

  describe("using --local", () => {
    it ("Prints out a TODO", async () => {
      await runCommand("key create --local --keyRole admin");
      expect(logger.stderr).to.have.been.calledWith(sinon.match("TODO"));
    });
  });
});

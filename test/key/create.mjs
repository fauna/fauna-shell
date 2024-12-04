//@ts-check

import { expect } from "chai";
import sinon from "sinon";

import { run } from "../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../src/config/setup-test-container.mjs";

describe.only("key create", () => {
  let container,
      fs,
      logger;

  beforeEach(() => {
    // reset the container before each test
    container = setupContainer();
    fs = container.resolve("fs");
    logger = container.resolve("logger");
  });

  [
    {
      command: "key create",
      expected: "Missing required argument: --database",
    },
    {
      args: "key create --database us-std --ttl taco",
      expected: "Invalid argument: --ttl must be an ISO 8601 date time",
    }
  ].forEach(({ command, expected }) => {
    it("Provides clear error when invalid args are provided", async ({ args, expected }) => {
      try {
        console.log("running");
        await run(command, container);
      } catch (e) {}
      
      expect(logger.stderr).to.have.been.calledWith(sinon.match(expected));
      expect(container.resolve("parseYargs")).to.have.been.calledOnce;
    });
  });

});

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

  [
    {
      command: "key create --ttl '2024-01-01T13:15:03Z'",
      expected: "Missing required argument: database",
    },
    {
      command: "key create --database us-std --ttl taco",
      expected: "Invalid ttl 'taco'. Provide as an ISO 8601 date time string.",
    },
  ].forEach(({ command, expected }) => {
    it("Provides clear error when invalid args are provided", async () => {
      try {
        await run(command, container);
      } catch (e) {}

      expect(logger.stderr).to.have.been.calledWith(sinon.match(expected));
      expect(container.resolve("parseYargs")).to.have.been.calledOnce;
    });
  });
});

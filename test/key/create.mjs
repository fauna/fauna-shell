//@ts-check

import { expect } from "chai";
import sinon from "sinon";

import { run } from "../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../src/config/setup-test-container.mjs";
import { formatObjectForShell } from "../../src/lib/misc.mjs";
import { mockAccessKeysFile } from "../helpers.mjs";

describe("key create", () => {
  let container, fs, logger, makeAccountRequest;

  beforeEach(() => {
    // reset the container before each test
    container = setupContainer();
    fs = container.resolve("fs");
    logger = container.resolve("logger");
    makeAccountRequest = container.resolve("makeAccountRequest");
  });

  async function runCommand(command) {
    return run(command, container);
  }

  [
    {
      command: "key create --keyRole admin",
      expected:
        "You must provide at least one of: --database, --secret, --local.",
    },
    {
      command: "key create --database us-std",
      expected: "Missing required argument: keyRole",
    },
    {
      command: "key create --database us-std --ttl taco --keyRole admin",
      expected: "Invalid ttl 'taco'. Provide a valid ISO 8601 timestamp.",
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

  describe("using a user", () => {
    [
      [
        "key create --database us-std/test --keyRole admin --ttl '3000-01-01T00:00:00Z' --name taco",
        true,
        true,
      ],
      [
        "key create --database us-std/test --keyRole admin --ttl '3000-01-01T00:00:00Z' --no-color --name taco",
        true,
        false,
      ],
      [
        "key create --database us-std/test --keyRole admin --ttl '3000-01-01T00:00:00Z' --json --name taco",
        false,
        true,
      ],
    ].forEach(([command, prettyPrinted, color]) => {
      it("Can call the create key API", async () => {
        mockAccessKeysFile({ fs });
        const stubbedResponse = {
          path: "us-std/test",
          ttl: "3000-01-01T00:00:00Z",
          secret: "foo",
          role: "admin",
        };
        const { path: database, ...rest } = stubbedResponse;
        const expected = { ...rest, database };
        makeAccountRequest.resolves(stubbedResponse);
        await runCommand(command);
        expect(makeAccountRequest).to.have.been.calledOnceWith({
          method: "POST",
          path: "/databases/keys",
          body: JSON.stringify({
            role: "admin",
            path: "us-std/test",
            ttl: "3000-01-01T00:00:00Z",
            name: "taco",
          }),
          secret: sinon.match.string,
        });
        expect(logger.stdout).to.have.been.calledOnceWith(
          prettyPrinted
            ? formatObjectForShell(expected, { color })
            : JSON.stringify(expected),
        );
      });
    });
  });

  describe("using --secret", () => {
    it("Prints out a TODO", async () => {
      await runCommand("key create --secret secret --keyRole admin");
      expect(logger.stderr).to.have.been.calledWith(sinon.match("TODO"));
    });
  });

  describe("using --local", () => {
    it("Prints out a TODO", async () => {
      await runCommand("key create --local --keyRole admin");
      expect(logger.stderr).to.have.been.calledWith(sinon.match("TODO"));
    });
  });
});

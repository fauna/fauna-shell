//@ts-check

import { expect } from "chai";
import { fql, ServiceError } from "fauna";
import sinon from "sinon";

import { run } from "../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../src/config/setup-test-container.mjs";

describe("completions", () => {
  describe("for directory paths", () => {
    let container, logger, runQuery;

    beforeEach(() => {
      // reset the container before each test
      container = setupContainer();
      logger = container.resolve("logger");
      runQuery = container.resolve("faunaClientV10").runQuery;
    });

    it("work with directory flags and their aliases", async () => {});
    it("are not suggested for non-directory flags", async () => {});
    it("work for nested relative paths", async () => {});
    it("work for relative paths higher in the filesystem", async () => {});
    it("suggest a trailing slash on a complete filename", async () => {});
    it("suggest a trailing slash or further completion on a complete filename that is also a partial match", async () => {});
    it("do not suggest file names", async () => {});
  });
});

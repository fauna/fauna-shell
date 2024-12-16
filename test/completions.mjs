//@ts-check

import { expect } from "chai";
import { match, stub } from "sinon";

import { run } from "../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../src/config/setup-test-container.mjs";
import { validDefaultConfigNames } from "../src/lib/config/config.mjs";
import { eventually, mockAccessKeysFile } from "./helpers.mjs";

const realLogger = console.log; // eslint-disable-line no-console
/**
 * @param {object} args
 * @prop {string} [configPath]
 * @prop {string} [matchFlag = ""] - the option/argument/flag before the substring to generate completions for. in `fauna query --profile hello`, the matchFlag is `profile`; do not include the leading `--`.
 * @prop {string} [matchSubstring = ""] - the substring generate completions for. in `fauna query --profile hello`, the matchSubstring is `hello`.
 * @prop {string} [command]
 * @prop {Record<string, string>} [env]
 * @prop {any} container
 */
async function complete({
  configPath,
  matchFlag = "",
  matchSubstring = "",
  container,
  command,
  env,
}) {
  // to test these manually in zsh/bash, do:
  // `fauna --get-yargs-completions fauna query --database "us-std/stringToComplete"`
  let commandString = `fauna --get-yargs-completions fauna`;
  if (command) commandString += ` ${command}`;
  if (configPath) commandString += ` --config ${configPath}`;
  commandString += ` --${matchFlag} ${matchSubstring}`;
  process.argv = commandString.split(" ");

  if (env) {
    for (const [key, value] of Object.entries(env)) {
      process.env[key] = value;
    }
  }

  await run(commandString.split(" "), container);
}

const basicConfig = {
  default: {},
  dev: {},
  prod: {},
};

const advancedConfig = {
  development: {},
  production: {},
};

const defaultNameConfig = {
  plain: {},
  boring: {},
};

describe("shell completion", () => {
  let container, fs, fakeLogger;

  beforeEach(() => {
    // reset the container before each test
    container = setupContainer();

    fakeLogger = stub();
    console.log = fakeLogger; // eslint-disable-line no-console
    fs = container.resolve("fs");
  });

  after(() => {
    console.log = realLogger; // eslint-disable-line no-console
  });

  describe("for profiles", () => {
    beforeEach(() => {
      fs.readdirSync.withArgs(match.any).returns([
        {
          isFile: () => true,
          name: validDefaultConfigNames[0],
          path: process.cwd(),
          parentParth: process.cwd(),
        },
      ]);
      fs.readFileSync
        .withArgs("/config/basic.yaml")
        .returns(JSON.stringify(basicConfig));
      fs.readFileSync
        .withArgs("/config/advanced.yaml")
        .returns(JSON.stringify(advancedConfig));
      fs.readFileSync
        .withArgs(validDefaultConfigNames[0])
        .returns(JSON.stringify(defaultNameConfig));
    });

    it("works with config files in the same directory with default names", async () => {
      await complete({
        container,
        matchFlag: "profile",
      });
      expect(fakeLogger).to.have.been.calledWith("plain");
      expect(fakeLogger).to.have.been.calledWith("boring");
    });

    it("works with config files chosen by flag or env var", async () => {
      await complete({
        container,
        matchFlag: "profile",
        env: {
          FAUNA_CONFIG: "/config/basic.yaml",
        },
      });
      expect(fakeLogger).to.have.been.calledWith("default");
      expect(fakeLogger).to.have.been.calledWith("dev");
      expect(fakeLogger).to.have.been.calledWith("prod");
    });

    it("prioritizes config file paths provided by flag over env vars", async () => {
      await complete({
        container,
        matchFlag: "profile",
        env: {
          FAUNA_CONFIG: "/config/basic.yaml",
        },
        configPath: "/config/advanced.yaml",
      });
      expect(fakeLogger).to.have.been.calledWith("development");
      expect(fakeLogger).to.have.been.calledWith("production");
    });

    it.skip("is resilient against wrapping quotes", async () => {});
  });

  describe("for databases", () => {
    beforeEach(() => {
      // reset the container before each test
      container = setupContainer();
      fs = container.resolve("fs");
      fs.readdirSync.withArgs(match.any).returns([
        {
          isFile: () => true,
          name: validDefaultConfigNames[0],
          path: process.cwd(),
          parentParth: process.cwd(),
        },
      ]);
      fs.readFileSync
        .withArgs("/config/basic.yaml")
        .returns(JSON.stringify(basicConfig));
      mockAccessKeysFile({ fs });

      let makeAccountRequest = container.resolve("makeAccountRequest");
      const stubbedResponse = { results: [{ name: "americacentric" }] };
      makeAccountRequest
        .withArgs(match({ path: "/databases", params: { path: "us-std" } }))
        .resolves(stubbedResponse);
    });

    it("suggests a region group if the current word doesn't start with a region group", async () => {
      await complete({
        container,
        matchFlag: "database",
        command: "query",
      });
      expect(fakeLogger).to.have.been.calledWith("eu-std");
      expect(fakeLogger).to.have.been.calledWith("us-std");
      expect(fakeLogger).to.have.been.calledWith("global");
    });

    it("suggests a top level database in the selected region group", async () => {
      let makeAccountRequest = container.resolve("makeAccountRequest");
      const stubbedResponse = { results: [{ name: "eurocentric" }] };
      makeAccountRequest
        .withArgs(match({ path: "/databases", params: { path: "eu-std" } }))
        .resolves(stubbedResponse);
      await complete({
        container,
        matchFlag: "database",
        matchSubstring: "eu-std/",
        command: "query",
      });

      await eventually(() => {
        expect(fakeLogger).to.have.been.calledWith("eu-std/eurocentric");
      });
    });

    it("suggests a nested level database in the selected region group", async () => {
      let makeAccountRequest = container.resolve("makeAccountRequest");
      const stubbedResponse = {
        results: [{ name: "1" }, { name: "2" }, { name: "3" }, { name: "4" }],
      };
      makeAccountRequest
        .withArgs(
          match({ path: "/databases", params: { path: "eu-std/a/b/c/d" } }),
        )
        .resolves(stubbedResponse);

      await complete({
        container,
        matchFlag: "database",
        matchSubstring: "eu-std/a/b/c/d",
        command: "query",
      });
      await eventually(() => {
        expect(fakeLogger).to.have.been.calledWith("eu-std/a/b/c/d/1");
        expect(fakeLogger).to.have.been.calledWith("eu-std/a/b/c/d/2");
        expect(fakeLogger).to.have.been.calledWith("eu-std/a/b/c/d/3");
        expect(fakeLogger).to.have.been.calledWith("eu-std/a/b/c/d/4");
      });
    });

    it.skip("is resilient against trailing slashes", async () => {});

    it.skip("is resilient against wrapping quotes", async () => {});
  });
});

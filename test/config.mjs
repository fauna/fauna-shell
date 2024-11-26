//@ts-check

import path from "node:path";

import * as awilix from "awilix";
import { expect } from "chai";
import chalk from "chalk";
import notAllowed from "not-allowed";
import sinon from "sinon";

import { builtYargs, run } from "../src/cli.mjs";
import { performQuery, performV10Query } from "../src/commands/eval.mjs";
import { setupTestContainer as setupContainer } from "../src/config/setup-test-container.mjs";
import { validDefaultConfigNames } from "../src/lib/config/config.mjs";

const __dirname = import.meta.dirname;

const yamlConfig = `
default:
  # comment!
  secret: "very-secret"
  url: "https://db.fauna.com:443"

dev:
  secret: "super-secret"
  url: "https://localhost:9999"
`.trim();

const jsonConfig = `
{
  "default": {
    "secret": "very-secret",
    "url": "https://db.fauna.com:443"
  },
  "dev": {
    "secret": "super-secret",
    "url": "https://localhost:9999"
  }
}
`.trim();

const databaseObject = `{
  data: [
    {
      name: "v4-test",
      coll: Database,
      ts: Time("2024-07-16T19:16:15.980Z"),
      global_id: "asd7zi8pharfn",
    },
  ],
}`;

describe("configuration file", function () {
  let container, stderr, stdout, fs;

  beforeEach(() => {
    container = setupContainer();
    container.register({
      performV10Query: awilix.asValue(performV10Query),
      performQuery: awilix.asValue(performQuery),
    });

    stderr = container.resolve("stderrStream");
    stdout = container.resolve("stdoutStream");
    fs = container.resolve("fs");
    delete process.env.FAUNA_CONFIG;
    delete process.env.FAUNA_SECRET;
  });

  /**
   * @param {object} args
   * @prop {string} cmd
   * @prop {any} [pathMatcher]
   * @prop {any} clientMatcher
   * @prop {string} [configToReturn]
   * @prop {object} objectToReturn
   * @prop {Record<string, string>} [env]
   */
  async function runBasicTest({
    cmd,
    pathMatcher,
    clientMatcher,
    configToReturn,
    objectToReturn,
    env = undefined,
  }) {
    if (pathMatcher)
      fs.readFileSync
        .callsFake(notAllowed)
        .withArgs(pathMatcher)
        .returns(configToReturn);

    // confirm that the default profile flags are used
    container
      .resolve("getSimpleClient")
      .callsFake(notAllowed)
      .withArgs(clientMatcher)
      .resolves({
        query: sinon
          .stub()
          .resolves({ status: 200, body: { data: objectToReturn } }),
        close: () => {},
      });

    if (env) {
      for (const [key, value] of Object.entries(env)) {
        process.env[key] = value;
      }
    }

    await run(cmd, container);

    expect(stdout.getWritten()).to.equal(`${objectToReturn}\n`);
    expect(stderr.getWritten()).to.equal("");
  }

  describe("debugging", function () {
    it.skip("emits debug logging at specified verbosity under the component 'config'", async function () {});
  });

  describe("location", function () {
    it("can be specified by setting a flag", async function () {
      await runBasicTest({
        cmd: `eval --config ./prod.yaml --query "Database.all()"`,
        pathMatcher: path.join(__dirname, "../prod.yaml"),
        clientMatcher: sinon.match({
          secret: "very-secret",
          url: "https://db.fauna.com:443",
        }),
        objectToReturn: databaseObject,
        configToReturn: yamlConfig,
      });
    });

    it("can be specified by setting an env variable", async function () {
      await runBasicTest({
        cmd: `eval --query "Database.all()"`,
        env: { FAUNA_CONFIG: path.join(__dirname, "../prod.yaml") },
        pathMatcher: path.join(__dirname, "../prod.yaml"),
        clientMatcher: sinon.match({
          secret: "very-secret",
          url: "https://db.fauna.com:443",
        }),
        objectToReturn: databaseObject,
        configToReturn: yamlConfig,
      });
    });

    it("a flag location is prioritized over an env var location", async function () {
      await runBasicTest({
        cmd: `eval --config ./dev.yaml --query "Database.all()"`,
        env: { FAUNA_CONFIG: "./prod.yaml" },
        pathMatcher: path.join(__dirname, "../dev.yaml"),
        clientMatcher: sinon.match({
          secret: "very-secret",
          url: "https://db.fauna.com:443",
        }),
        objectToReturn: databaseObject,
        configToReturn: yamlConfig,
      });
    });

    it("defaults to looking for ./[.]fauna.config<.yaml|.yml|.json>", async function () {
      fs.readdirSync.withArgs(process.cwd()).returns([
        // files with the wrong names aren't considered default named configs
        { name: "not-config.yaml", isFile: () => true },
        { name: "also-not-config.json", isFile: () => true },
        // directories aren't considered default named configs
        { name: validDefaultConfigNames[0], isFile: () => false },
        // this is a valid default config!
        { name: validDefaultConfigNames[1], isFile: () => true },
      ]);

      await runBasicTest({
        cmd: `eval --query "Database.all()"`,
        clientMatcher: sinon.match({
          secret: "very-secret",
        }),
        pathMatcher: validDefaultConfigNames[1],
        configToReturn: jsonConfig,
        objectToReturn: databaseObject,
      });
    });

    it("does not exit with an error if the config file is not in the default location", async function () {
      fs.readdirSync.withArgs(process.cwd()).returns([]);
      await runBasicTest({
        cmd: `eval --query "Database.all()" --secret "no-config"`,
        clientMatcher: sinon.match({
          secret: "no-config",
          url: "https://db.fauna.com:443",
        }),
        objectToReturn: databaseObject,
      });
    });

    it("exits with an error if multiple default files exist", async function () {
      fs.readdirSync
        .withArgs(process.cwd())
        .returns(
          validDefaultConfigNames.map((name) => ({ name, isFile: () => true })),
        );

      try {
        await run(`eval --query "Database.all()"`, container);
      } catch (e) {}

      const errorText = `Multiple config files found with valid default names (${validDefaultConfigNames.join(", ")}). Either specify one with "--config FILENAME" or delete the unused config files.`;
      const message = `${chalk.reset(await builtYargs.getHelp())}\n\n${chalk.red(errorText)}\n`;
      expect(stdout.getWritten()).to.equal("");
      expect(stderr.getWritten()).to.equal(message);
    });

    it("exits with an error if the config file is not in a user-specified location", async function () {
      const configPath = path.join(__dirname, "../dev.yaml");
      const fakeFSError = new Error(
        `no such file or directory, open ${configPath}`,
      );
      // @ts-ignore
      fakeFSError.code = "ENOENT";
      fs.readFileSync
        .callsFake(notAllowed)
        .withArgs(configPath)
        .throws(fakeFSError);

      try {
        await run(
          `eval --config ./dev.yaml --query "Database.all()"`,
          container,
        );
      } catch (e) {}

      const errorText = `Config file not found at path ${configPath}.`;
      const message = `${chalk.reset(await builtYargs.getHelp())}\n\n${chalk.red(errorText)}\n`;
      expect(stdout.getWritten()).to.equal("");
      expect(stderr.getWritten()).to.equal(message);
    });
  });

  describe("parsing", function () {
    it("can parse YAML", async function () {
      await runBasicTest({
        cmd: `eval --config ./dev.yaml --query "Database.all()"`,
        pathMatcher: path.join(__dirname, "../dev.yaml"),
        clientMatcher: sinon.match({
          secret: "very-secret",
          url: "https://db.fauna.com:443",
        }),
        objectToReturn: databaseObject,
        configToReturn: yamlConfig,
      });
    });

    it("can parse JSON", async function () {
      await runBasicTest({
        cmd: `eval --config ./dev.yaml --query "Database.all()"`,
        pathMatcher: path.join(__dirname, "../dev.yaml"),
        clientMatcher: sinon.match({
          secret: "very-secret",
          url: "https://db.fauna.com:443",
        }),
        objectToReturn: databaseObject,
        configToReturn: jsonConfig,
      });
    });

    it.skip("supports all global config options", async function () {});
    it.skip("does not exit with an error if the config file is empty", async function () {});
    it("exits with an error if no profile is specified and the config does not have a 'default' key", async function () {
      const noDefaultConfig = JSON.stringify({
        dev: {
          secret: "shouted",
          url: "https://custom-location.com",
        },
      });

      try {
        await runBasicTest({
          cmd: `eval --config ./dev.yaml --query "Database.all()"`,
          pathMatcher: path.join(__dirname, "../dev.yaml"),
          clientMatcher: sinon.match({
            secret: "very-secret",
            url: "https://db.fauna.com:443",
          }),
          objectToReturn: databaseObject,
          configToReturn: noDefaultConfig,
        });
      } catch (e) {}
      const errorText = `No "default" profile found in config file at ${path.join(__dirname, "../dev.yaml")}. Either specify a profile with "--profile NAME" or add a "default" profile.`;
      const message = `${chalk.reset(await builtYargs.getHelp())}\n\n${chalk.red(errorText)}\n`;
      expect(stdout.getWritten()).to.equal("");
      expect(stderr.getWritten()).to.equal(message);
    });

    it("exits with an error if a profile is specified and the config does not have that key", async function () {
      fs.readFileSync
        .callsFake(notAllowed)
        .withArgs(path.join(__dirname, "../prod.yaml"))
        .returns(jsonConfig);

      try {
        await run(
          `eval --config ./prod.yaml --query "Database.all()" --profile nonexistent`,
          container,
        );
      } catch (e) {}

      const errorText = `Could not find profile "nonexistent" in config file at ${path.join(__dirname, "../prod.yaml")}.`;
      const message = `${chalk.reset(await builtYargs.getHelp())}\n\n${chalk.red(errorText)}\n`;
      expect(stdout.getWritten()).to.equal("");
      expect(stderr.getWritten()).to.equal(message);
    });
    it.skip("preserves comments in the config file", async function () {});
  });

  describe("evaluation", function () {
    it.skip("is applied to commands", async function () {});

    it("prioritizes flags over env variables", async function () {
      await runBasicTest({
        cmd: `eval --secret whispered --config ./dev.yaml --query "Database.all()"`,
        env: { FAUNA_SECRET: "not-so-secret" },
        pathMatcher: path.join(__dirname, "../dev.yaml"),
        clientMatcher: sinon.match({
          query: "Database.all()",
          secret: "whispered",
          url: "https://db.fauna.com:443",
        }),
        objectToReturn: databaseObject,
        configToReturn: jsonConfig,
      });
    });

    it("prioritizes env variables over config entries", async function () {
      await runBasicTest({
        cmd: `eval --config ./dev.yaml --query "Database.all()"`,
        env: { FAUNA_SECRET: "not-so-secret" },
        pathMatcher: path.join(__dirname, "../dev.yaml"),
        clientMatcher: sinon.match({
          query: "Database.all()",
          secret: "not-so-secret",
          url: "https://db.fauna.com:443",
        }),
        objectToReturn: databaseObject,
        configToReturn: jsonConfig,
      });
    });

    it("selects values from the correct profile", async function () {
      await runBasicTest({
        cmd: `eval --profile dev --config ./dev.yaml --query "Database.all()"`,
        pathMatcher: sinon.match.any,
        clientMatcher: sinon.match({
          secret: "super-secret",
          url: "https://localhost:9999",
        }),
        objectToReturn: databaseObject,
        configToReturn: jsonConfig,
      });
    });
  });
});

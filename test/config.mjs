//@ts-check

import path from "node:path";

import { expect } from "chai";
import notAllowed from "not-allowed";
import sinon from "sinon";
import stripAnsi from "strip-ansi";

import { builtYargs, run } from "../src/cli.mjs";
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
    "url": "https://db.fauna.com:443",
  },
  "dev": {
    "secret": "super-secret",
    "url": "https://localhost:9999",
  }
}
`.trim();

const databaseObject = {
  data: [
    {
      name: "test",
      coll: "Database",
      ts: "2024-07-16T19:16:15.980Z",
      global_id: "asd7zi8pharfn",
    },
  ],
};

describe("configuration file", function () {
  let container, stderr, stdout, fs;

  beforeEach(() => {
    container = setupContainer();

    stderr = container.resolve("stderrStream");
    stdout = container.resolve("stdoutStream");
    fs = container.resolve("fs");
    delete process.env.FAUNA_CONFIG;
    delete process.env.FAUNA_SECRET;
    delete process.env.FAUNA_PROFILE;
  });

  /**
   * @param {object} args
   * @prop {string} cmd
   * @prop {any} [pathMatcher]
   * @prop {any} argvMatcher
   * @prop {string} [configToReturn]
   * @prop {object} objectToReturn
   * @prop {Record<string, string>} [env]
   */
  async function runArgvTest({
    cmd,
    pathMatcher,
    argvMatcher,
    configToReturn,
    env = undefined,
  }) {
    if (pathMatcher)
      fs.readFileSync
        .callsFake(notAllowed)
        .withArgs(pathMatcher)
        .returns(configToReturn);

    if (env) {
      for (const [key, value] of Object.entries(env)) {
        process.env[key] = value;
      }
    }

    await run(cmd, container);

    expect(container.resolve("logger").stdout).to.have.been.calledWith(
      argvMatcher,
    );
    expect(stderr.getWritten()).to.equal("");
  }

  describe("debugging", function () {
    it.skip("emits debug logging at specified verbosity under the component 'config'", async function () {});
  });

  describe("location", function () {
    it("can be specified by setting a flag", async function () {
      await runArgvTest({
        cmd: `argv --config ./prod.yaml --profile default`,
        pathMatcher: path.join(__dirname, "../prod.yaml"),
        argvMatcher: sinon.match({
          secret: "very-secret",
          url: "https://db.fauna.com:443",
        }),
        configToReturn: yamlConfig,
      });
    });

    it("can be specified by setting an env variable", async function () {
      await runArgvTest({
        cmd: `argv`,
        env: {
          FAUNA_CONFIG: path.join(__dirname, "../prod.yaml"),
          FAUNA_PROFILE: "default",
        },
        pathMatcher: path.join(__dirname, "../prod.yaml"),
        argvMatcher: sinon.match({
          secret: "very-secret",
          url: "https://db.fauna.com:443",
        }),
        configToReturn: yamlConfig,
      });
    });

    it("a flag location is prioritized over an env var location", async function () {
      await runArgvTest({
        cmd: `argv --config ./dev.yaml`,
        env: { FAUNA_CONFIG: "./prod.yaml", FAUNA_PROFILE: "default" },
        pathMatcher: path.join(__dirname, "../dev.yaml"),
        argvMatcher: sinon.match({
          secret: "very-secret",
          url: "https://db.fauna.com:443",
        }),
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

      await runArgvTest({
        cmd: `argv --profile default`,
        argvMatcher: sinon.match({
          secret: "very-secret",
          url: "https://db.fauna.com:443",
        }),
        pathMatcher: validDefaultConfigNames[1],
        configToReturn: jsonConfig,
      });
    });

    it("does not exit with an error if the config file is not in the default location", async function () {
      fs.readdirSync.withArgs(process.cwd()).returns([]);
      await runArgvTest({
        cmd: `argv --secret "no-config"`,
        argvMatcher: sinon.match({
          secret: "no-config",
          url: "https://db.fauna.com",
        }),
      });
    });

    it("--local arg sets the argv.url to http://localhost:8443 if no --url is given", async function () {
      fs.readdirSync.withArgs(process.cwd()).returns([]);
      await runArgvTest({
        cmd: `argv --secret "no-config" --local`,
        argvMatcher: sinon.match({
          secret: "no-config",
          url: "http://localhost:8443",
        }),
      });
    });

    it("--url arg takes precedence over --local arg for the argv.url", async function () {
      fs.readdirSync.withArgs(process.cwd()).returns([]);
      await runArgvTest({
        cmd: `argv --secret "no-config" --local --url http://localhost:hibob`,
        argvMatcher: sinon.match({
          secret: "no-config",
          url: "http://localhost:hibob",
        }),
      });
    });

    it("--local sets the argv.secret to 'secret' if no --secret is given", async function () {
      fs.readdirSync.withArgs(process.cwd()).returns([]);
      await runArgvTest({
        cmd: `argv --local`,
        argvMatcher: sinon.match({
          secret: "secret",
          url: "http://localhost:8443",
        }),
      });
    });

    it("--secret arg takes precedence over --local arg for the argv.secret", async function () {
      fs.readdirSync.withArgs(process.cwd()).returns([]);
      await runArgvTest({
        cmd: `argv --local --secret "sauce"`,
        argvMatcher: sinon.match({
          secret: "sauce",
          url: "http://localhost:8443",
        }),
      });
    });

    it("exits with an error if multiple default files exist", async function () {
      fs.readdirSync
        .withArgs(process.cwd())
        .returns(
          validDefaultConfigNames.map((name) => ({ name, isFile: () => true })),
        );

      try {
        await run(`argv`, container);
      } catch (e) {}

      const errorText = `Multiple config files found with valid default names (${validDefaultConfigNames.join(", ")}). Either specify one with "--config FILENAME" or delete the unused config files.`;
      const message = `${await builtYargs.getHelp()}\n\n${errorText}\n`;
      expect(stdout.getWritten()).to.equal("");
      expect(stripAnsi(stderr.getWritten())).to.equal(message);
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
        await run(`argv --config ./dev.yaml --profile default`, container);
      } catch (e) {}

      const errorText = `Config file not found at path ${configPath}.`;
      const message = `${await builtYargs.getHelp()}\n\n${errorText}\n`;
      expect(stdout.getWritten()).to.equal("");
      expect(stripAnsi(stderr.getWritten())).to.equal(message);
    });
  });

  describe("parsing", function () {
    it("can parse YAML", async function () {
      await runArgvTest({
        cmd: `argv --config ./dev.yaml --profile default`,
        pathMatcher: path.join(__dirname, "../dev.yaml"),
        argvMatcher: sinon.match({
          secret: "very-secret",
          url: "https://db.fauna.com:443",
        }),
        objectToReturn: databaseObject,
        configToReturn: yamlConfig,
      });
    });

    it("can parse JSON", async function () {
      await runArgvTest({
        cmd: `argv --config ./dev.yaml --profile default`,
        pathMatcher: path.join(__dirname, "../dev.yaml"),
        argvMatcher: sinon.match({
          secret: "very-secret",
          url: "https://db.fauna.com:443",
        }),
        configToReturn: jsonConfig,
      });
    });

    it.skip("supports all global config options", async function () {});
    it.skip("does not exit with an error if the config file is empty", async function () {});
    it("exits with an error if no profile is specified with user-provided config path", async function () {
      const noDefaultConfig = JSON.stringify({
        dev: {
          secret: "shouted",
          url: "https://custom-location.com",
        },
      });

      try {
        await runArgvTest({
          cmd: `argv --config ./dev.yaml`,
          pathMatcher: path.join(__dirname, "../dev.yaml"),
          argvMatcher: sinon.match({
            apiVersion: "10",
            secret: "very-secret",
            url: "https://db.fauna.com:443",
            timeout: 5000,
            typecheck: undefined,
          }),
          objectToReturn: databaseObject,
          configToReturn: noDefaultConfig,
        });
      } catch (e) {}
      const errorText = `A config file was provided at "${path.join(__dirname, "../dev.yaml")}" but no profile was specified. Provide a profile value with --profile or FAUNA_PROFILE env var to use the config file.`;
      const message = `${await builtYargs.getHelp()}\n\n${errorText}\n`;
      expect(stdout.getWritten()).to.equal("");
      expect(stripAnsi(stderr.getWritten())).to.equal(message);
    });

    it("exits with an error if a profile is specified and the config does not have that key", async function () {
      fs.readFileSync
        .callsFake(notAllowed)
        .withArgs(path.join(__dirname, "../prod.yaml"))
        .returns(jsonConfig);

      try {
        await run(
          `eval --config ./prod.yaml "Database.all()" --profile nonexistent`,
          container,
        );
      } catch (e) {}

      const errorText = `Could not find profile "nonexistent" in config file at ${path.join(__dirname, "../prod.yaml")}.`;
      const message = `${await builtYargs.getHelp()}\n\n${errorText}\n`;
      expect(stdout.getWritten()).to.equal("");
      expect(stripAnsi(stderr.getWritten())).to.equal(message);
    });

    it("exits with an error if a profile is specified and there is no config", async function () {
      try {
        await run(`argv --profile nonexistent`, container);
      } catch (e) {}

      const errorText = `Profile "nonexistent" cannot be specified because there was no config file found at "${path.join(__dirname, "..")}". Remove the profile, or provide a config file.`;
      const message = `${await builtYargs.getHelp()}\n\n${errorText}\n`;
      expect(stdout.getWritten()).to.equal("");
      expect(stripAnsi(stderr.getWritten())).to.equal(message);
    });

    it.skip("preserves comments in the config file", async function () {});
  });

  describe("evaluation", function () {
    it.skip("is applied to commands", async function () {});

    it("prioritizes flags over env variables", async function () {
      await runArgvTest({
        cmd: `argv --secret whispered --config ./dev.yaml`,
        env: { FAUNA_SECRET: "not-so-secret", FAUNA_PROFILE: "default" },
        pathMatcher: path.join(__dirname, "../dev.yaml"),
        argvMatcher: sinon.match({
          secret: "whispered",
          url: "https://db.fauna.com:443",
        }),
        objectToReturn: databaseObject,
        configToReturn: jsonConfig,
      });
    });

    it("prioritizes env variables over config entries", async function () {
      await runArgvTest({
        cmd: `argv --config ./dev.yaml`,
        env: { FAUNA_SECRET: "not-so-secret", FAUNA_PROFILE: "default" },
        pathMatcher: path.join(__dirname, "../dev.yaml"),
        argvMatcher: sinon.match({
          secret: "not-so-secret",
          url: "https://db.fauna.com:443",
        }),
        configToReturn: jsonConfig,
      });
    });

    it("selects values from the correct profile", async function () {
      await runArgvTest({
        cmd: `argv --profile dev --config ./dev.yaml`,
        pathMatcher: sinon.match.any,
        argvMatcher: sinon.match({
          secret: "super-secret",
          url: "https://localhost:9999",
        }),
        configToReturn: jsonConfig,
      });
    });
  });
});

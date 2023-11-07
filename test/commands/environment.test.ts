import { Config } from "@oclif/core";
import { expect, test } from "@oclif/test";
import sinon, { SinonStub } from "sinon";
import AddEnvironmentComand from "../../src/commands/environment/add";
import ListEnvironmentCommand from "../../src/commands/environment/list";
import SelectEnvironmentCommand from "../../src/commands/environment/select";
import { ShellConfig } from "../../src/lib/config";

const rootConfig = {
  "my-endpoint": {
    url: "http://localhost:8443",
    secret: "secret",
  },
};

const stubbedProjectConfig = (
  projectConfig: any
): ShellConfig & { saveProjectConfig: SinonStub } => {
  const config = new ShellConfig({
    flags: {},
    rootConfig,
    projectConfig,
    projectPath: "/foo/bar",
  });
  sinon.stub(config, "saveProjectConfig");

  return config as any;
};

describe("environment:add", () => {
  test
    .add("config", () =>
      stubbedProjectConfig({
        default: "my-app",
        environment: {
          "my-app": {
            endpoint: "my-endpoint",
            database: "my-db",
          },
        },
      })
    )
    .stdout()
    .do((ctx) =>
      new AddEnvironmentComand(
        [
          "--non-interactive",
          "--name",
          "foobar",
          "--endpoint",
          "my-endpoint",
          "--database",
          "my-db",
        ],
        new Config({} as any)
      ).execute(ctx.config)
    )
    .it("adds a environment", (ctx) => {
      expect(ctx.stdout).to.equal(
        "Saved environment foobar to /foo/bar/.fauna-project\n"
      );
      expect(ctx.config.projectConfig).to.deep.equal({
        defaultEnvironment: "my-app",
        schemaDir: undefined,
        environments: {
          "my-app": {
            endpoint: "my-endpoint",
            database: "my-db",
          },
          foobar: {
            endpoint: "my-endpoint",
            database: "my-db",
          },
        },
      });
      expect(ctx.config.saveProjectConfig.calledOnce).to.be.true;
    });

  test
    .add("config", () =>
      stubbedProjectConfig({
        default: "my-app",
        environment: {
          "my-app": {
            endpoint: "my-endpoint",
            database: "my-db",
          },
        },
      })
    )
    .stdout()
    .do((ctx) =>
      new AddEnvironmentComand(
        [
          "--non-interactive",
          "--name",
          "foobar",
          "--endpoint",
          "my-endpoint",
          "--database",
          "my-db",
          "--set-default",
        ],
        new Config({} as any)
      ).execute(ctx.config)
    )
    .it("adds a environment as default", (ctx) => {
      expect(ctx.stdout).to.equal(
        "Saved environment foobar to /foo/bar/.fauna-project\n"
      );
      expect(ctx.config.projectConfig).to.deep.equal({
        defaultEnvironment: "foobar",
        schemaDir: undefined,
        environments: {
          "my-app": {
            endpoint: "my-endpoint",
            database: "my-db",
          },
          foobar: {
            endpoint: "my-endpoint",
            database: "my-db",
          },
        },
      });
      expect(ctx.config.saveProjectConfig.calledOnce).to.be.true;
    });

  test
    .add("config", () =>
      stubbedProjectConfig({
        default: "my-app",
        environment: {
          "my-app": {
            endpoint: "my-endpoint",
            database: "my-db",
          },
        },
      })
    )
    .stdout()
    .do((ctx) =>
      new AddEnvironmentComand(
        [
          "--non-interactive",
          "--name",
          "my-app",
          "--endpoint",
          "my-endpoint",
          "--database",
          "my-db",
        ],
        new Config({} as any)
      ).execute(ctx.config)
    )
    .catch((e) => {
      expect(e.message).to.equal("Environment my-app already exists");
    })
    .it("disallows environments with the same name", (ctx) => {
      expect(ctx.config.projectConfig).to.deep.equal({
        defaultEnvironment: "my-app",
        schemaDir: undefined,
        environments: {
          "my-app": {
            endpoint: "my-endpoint",
            database: "my-db",
          },
        },
      });
      expect(ctx.config.saveProjectConfig.called).to.be.false;
    });

  test
    .add("config", () =>
      stubbedProjectConfig({
        default: "my-app",
        environment: {
          "my-app": {
            endpoint: "my-endpoint",
            database: "my-db",
          },
        },
      })
    )
    .stdout()
    .do((ctx) =>
      new AddEnvironmentComand(
        [
          "--non-interactive",
          "--name",
          "foobar",
          "--endpoint",
          "doesnt-exist-endpoint",
          "--database",
          "my-db",
        ],
        new Config({} as any)
      ).execute(ctx.config)
    )
    .catch((e) => {
      expect(e.message).to.equal("No such endpoint 'doesnt-exist-endpoint'");
    })
    .it("disallows endpoints that don't exist", (ctx) => {
      expect(ctx.config.projectConfig).to.deep.equal({
        defaultEnvironment: "my-app",
        schemaDir: undefined,
        environments: {
          "my-app": {
            endpoint: "my-endpoint",
            database: "my-db",
          },
        },
      });
      expect(ctx.config.saveProjectConfig.called).to.be.false;
    });
});

describe("environment:list", () => {
  test
    .add("config", () =>
      stubbedProjectConfig({
        default: "my-app",
        environment: {
          foobar: {
            endpoint: "my-endpoint",
            database: "my-db",
          },
          "my-app": {
            endpoint: "my-endpoint",
            database: "my-db",
          },
          baz: {
            endpoint: "my-endpoint",
            database: "my-db",
          },
        },
      })
    )
    .stdout()
    .do((ctx) =>
      new ListEnvironmentCommand([], new Config({} as any)).execute(ctx.config)
    )
    .it("lists environment", (ctx) => {
      expect(ctx.stdout).to.equal(
        "Available environments:\n  foobar\n* my-app\n  baz\n"
      );
      expect(ctx.config.saveProjectConfig.called).to.be.false;
    });
});

describe("environment:select", () => {
  test
    .add("config", () =>
      stubbedProjectConfig({
        default: "my-app",
        environment: {
          "my-app": {
            endpoint: "my-endpoint",
            database: "my-db",
          },
          "foo-app": {
            endpoint: "my-endpoint",
            database: "my-db",
          },
        },
      })
    )
    .stdout()
    .do((ctx) =>
      new SelectEnvironmentCommand(["foo-app"], new Config({} as any)).execute(
        ctx.config
      )
    )
    .it("selects a environment", (ctx) => {
      expect(ctx.stdout).to.equal("Selected environment foo-app\n");
      expect(ctx.config.projectConfig).to.deep.equal({
        defaultEnvironment: "foo-app",
        schemaDir: undefined,
        environments: {
          "my-app": {
            endpoint: "my-endpoint",
            database: "my-db",
          },
          "foo-app": {
            endpoint: "my-endpoint",
            database: "my-db",
          },
        },
      });
      expect(ctx.config.saveProjectConfig.calledOnce).to.be.true;
    });

  test
    .add("config", () =>
      stubbedProjectConfig({
        default: "my-app",
        environment: {
          "my-app": {
            endpoint: "my-endpoint",
            database: "my-db",
          },
          "foo-app": {
            endpoint: "my-endpoint",
            database: "my-db",
          },
        },
      })
    )
    .stdout()
    .do((ctx) =>
      new SelectEnvironmentCommand(["baz-app"], new Config({} as any)).execute(
        ctx.config
      )
    )
    .catch((e) => {
      expect(e.message).to.equal(
        "Environment baz-app not found in project config. Run `fauna environment list` to see available environments"
      );
    })
    .it("disallows environments that don't exist", (ctx) => {
      expect(ctx.config.projectConfig).to.deep.equal({
        defaultEnvironment: "my-app",
        schemaDir: undefined,
        environments: {
          "my-app": {
            endpoint: "my-endpoint",
            database: "my-db",
          },
          "foo-app": {
            endpoint: "my-endpoint",
            database: "my-db",
          },
        },
      });
      expect(ctx.config.saveProjectConfig.called).to.be.false;
    });
});

import { expect, test } from "@oclif/test";
import { ShellConfig } from "../../src/lib/config";
import sinon, { SinonStub } from "sinon";
import AddStackCommand from "../../src/commands/stack/add";
import ListStackCommand from "../../src/commands/stack/list";
import SelectStackCommand from "../../src/commands/stack/select";
import { Config } from "@oclif/core";

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

describe("stack:add", () => {
  test
    .add("config", () =>
      stubbedProjectConfig({
        default: "my-app",
        stack: {
          "my-app": {
            endpoint: "my-endpoint",
            database: "my-db",
          },
        },
      })
    )
    .stdout()
    .do((ctx) =>
      new AddStackCommand(
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
    .it("adds a stack", (ctx) => {
      expect(ctx.stdout).to.equal(
        "Saved stack foobar to /foo/bar/.fauna-project\n"
      );
      expect(ctx.config.projectConfig).to.deep.equal({
        defaultStack: "my-app",
        schemaDir: undefined,
        stacks: {
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
        stack: {
          "my-app": {
            endpoint: "my-endpoint",
            database: "my-db",
          },
        },
      })
    )
    .stdout()
    .do((ctx) =>
      new AddStackCommand(
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
    .it("adds a stack as default", (ctx) => {
      expect(ctx.stdout).to.equal(
        "Saved stack foobar to /foo/bar/.fauna-project\n"
      );
      expect(ctx.config.projectConfig).to.deep.equal({
        defaultStack: "foobar",
        schemaDir: undefined,
        stacks: {
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
        stack: {
          "my-app": {
            endpoint: "my-endpoint",
            database: "my-db",
          },
        },
      })
    )
    .stdout()
    .do((ctx) =>
      new AddStackCommand(
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
      expect(e.message).to.equal("Stack my-app already exists");
    })
    .it("disallows stacks with the same name", (ctx) => {
      expect(ctx.config.projectConfig).to.deep.equal({
        defaultStack: "my-app",
        schemaDir: undefined,
        stacks: {
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
        stack: {
          "my-app": {
            endpoint: "my-endpoint",
            database: "my-db",
          },
        },
      })
    )
    .stdout()
    .do((ctx) =>
      new AddStackCommand(
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
        defaultStack: "my-app",
        schemaDir: undefined,
        stacks: {
          "my-app": {
            endpoint: "my-endpoint",
            database: "my-db",
          },
        },
      });
      expect(ctx.config.saveProjectConfig.called).to.be.false;
    });
});

describe("stack:list", () => {
  test
    .add("config", () =>
      stubbedProjectConfig({
        default: "my-app",
        stack: {
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
      new ListStackCommand([], new Config({} as any)).execute(ctx.config)
    )
    .it("lists stack", (ctx) => {
      expect(ctx.stdout).to.equal(
        "Available stacks:\n  foobar\n* my-app\n  baz\n"
      );
      expect(ctx.config.saveProjectConfig.called).to.be.false;
    });
});

describe("stack:select", () => {
  test
    .add("config", () =>
      stubbedProjectConfig({
        default: "my-app",
        stack: {
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
      new SelectStackCommand(["foo-app"], new Config({} as any)).execute(
        ctx.config
      )
    )
    .it("selects a stack", (ctx) => {
      expect(ctx.stdout).to.equal("Selected stack foo-app\n");
      expect(ctx.config.projectConfig).to.deep.equal({
        defaultStack: "foo-app",
        schemaDir: undefined,
        stacks: {
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
        stack: {
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
      new SelectStackCommand(["baz-app"], new Config({} as any)).execute(
        ctx.config
      )
    )
    .catch((e) => {
      expect(e.message).to.equal(
        "Stack baz-app not found in project config. Run `fauna stack list` to see available stacks"
      );
    })
    .it("disallows stacks that don't exist", (ctx) => {
      expect(ctx.config.projectConfig).to.deep.equal({
        defaultStack: "my-app",
        schemaDir: undefined,
        stacks: {
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

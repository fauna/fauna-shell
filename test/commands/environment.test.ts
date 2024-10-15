import { expect } from "chai";
import { captureOutput } from "@oclif/test";
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

afterEach(() => {
  sinon.restore();
});

describe("environment:add", () => {
  it("adds an environment", async function () {
    this.config = stubbedProjectConfig({
      default: "my-app",
      environment: {
        "my-app": {
          endpoint: "my-endpoint",
          database: "my-db",
        },
      },
    });
    sinon.stub(ShellConfig, "read").returns(this.config);
    const { stdout } = await captureOutput(async () =>
      AddEnvironmentComand.run([
        "--no-input",
        "--name",
        "foobar",
        "--endpoint",
        "my-endpoint",
        "--database",
        "my-db",
      ])
    );
    expect(stdout).to.equal(
      "Saved environment foobar to /foo/bar/.fauna-project\n"
    );
    expect(this.config.projectConfig).to.deep.equal({
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
    expect(this.config.saveProjectConfig.calledOnce).to.be.true;
  });

  it("adds an environment as default", async function () {
    this.config = stubbedProjectConfig({
      default: "my-app",
      environment: {
        "my-app": {
          endpoint: "my-endpoint",
          database: "my-db",
        },
      },
    });
    sinon.stub(ShellConfig, "read").returns(this.config);
    const { stdout } = await captureOutput(async () =>
      AddEnvironmentComand.run([
        "--no-input",
        "--name",
        "foobar",
        "--endpoint",
        "my-endpoint",
        "--database",
        "my-db",
        "--set-default",
      ])
    );
    expect(stdout).to.equal(
      "Saved environment foobar to /foo/bar/.fauna-project\n"
    );
    expect(this.config.projectConfig).to.deep.equal({
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
    expect(this.config.saveProjectConfig.calledOnce).to.be.true;
  });

  it("disallows environments with the same name", async function () {
    this.config = stubbedProjectConfig({
      default: "my-app",
      environment: {
        "my-app": {
          endpoint: "my-endpoint",
          database: "my-db",
        },
      },
    });
    sinon.stub(ShellConfig, "read").returns(this.config);
    const { error } = await captureOutput(async () =>
      AddEnvironmentComand.run([
        "--no-input",
        "--name",
        "my-app",
        "--endpoint",
        "my-endpoint",
        "--database",
        "my-db",
      ])
    );
    expect(error).not.to.be.undefined;
    expect(error?.message).to.equal("Environment my-app already exists");
    expect(this.config.projectConfig).to.deep.equal({
      defaultEnvironment: "my-app",
      schemaDir: undefined,
      environments: {
        "my-app": {
          endpoint: "my-endpoint",
          database: "my-db",
        },
      },
    });
    expect(this.config.saveProjectConfig.called).to.be.false;
  });

  it("disallows endpoints that don't exist", async function () {
    this.config = stubbedProjectConfig({
      default: "my-app",
      environment: {
        "my-app": {
          endpoint: "my-endpoint",
          database: "my-db",
        },
      },
    });
    sinon.stub(ShellConfig, "read").returns(this.config);
    const { error } = await captureOutput(async () =>
      AddEnvironmentComand.run([
        "--no-input",
        "--name",
        "foobar",
        "--endpoint",
        "doesnt-exist-endpoint",
        "--database",
        "my-db",
      ])
    );
    expect(error).not.to.be.undefined;
    expect(error?.message).to.equal("No such endpoint 'doesnt-exist-endpoint'");
    expect(this.config.projectConfig).to.deep.equal({
      defaultEnvironment: "my-app",
      schemaDir: undefined,
      environments: {
        "my-app": {
          endpoint: "my-endpoint",
          database: "my-db",
        },
      },
    });
    expect(this.config.saveProjectConfig.called).to.be.false;
  });

  describe("environment:list", () => {
    it("lists environments", async function () {
      this.config = stubbedProjectConfig({
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
      });
      sinon.stub(ShellConfig, "read").returns(this.config);
      const { stdout } = await captureOutput(async () =>
        ListEnvironmentCommand.run([])
      );
      expect(stdout).to.equal(
        "Available environments:\n  foobar\n* my-app\n  baz\n"
      );
      expect(this.config.saveProjectConfig.called).to.be.false;
    });
  });
  describe("environment:select", () => {
    it("selects an environment", async function () {
      this.config = stubbedProjectConfig({
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
      });
      sinon.stub(ShellConfig, "read").returns(this.config);
      const { stdout } = await captureOutput(async () =>
        SelectEnvironmentCommand.run(["foo-app"])
      );
      expect(stdout).to.equal("Selected environment foo-app\n");
      expect(this.config.projectConfig).to.deep.equal({
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
      expect(this.config.saveProjectConfig.calledOnce).to.be.true;
    });

    it("disallows environments that don't exist", async function () {
      this.config = stubbedProjectConfig({
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
      });
      sinon.stub(ShellConfig, "read").returns(this.config);
      const { error } = await captureOutput(async () =>
        SelectEnvironmentCommand.run(["baz-app"])
      );
      expect(error?.message).to.equal(
        "Environment baz-app not found in project config. Run `fauna environment list` to see available environments"
      );
      expect(this.config.projectConfig).to.deep.equal({
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
      expect(this.config.saveProjectConfig.called).to.be.false;
    });
  });
});

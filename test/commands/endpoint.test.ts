import { expect } from "chai";
import { captureOutput } from "@oclif/test";
import { ShellConfig, getRootConfigPath } from "../../src/lib/config";
import sinon, { SinonStub } from "sinon";
import AddEndpointCommand from "../../src/commands/endpoint/add";
import ListEndpointCommand from "../../src/commands/endpoint/list";
import RemoveEndpointCommand from "../../src/commands/endpoint/remove";
import { Secret } from "../../src/lib/secret";

const rootConfigPath = getRootConfigPath();

const stubbedRootConfig = (
  rootConfig: any
): ShellConfig & { saveRootConfig: SinonStub } => {
  const config = new ShellConfig({
    flags: {},
    rootConfig,
  });
  sinon.stub(config, "saveRootConfig");

  return config as any;
};

afterEach(() => {
  sinon.restore();
});

describe("endpoint:add", () => {
  it("adds an endpoint", async function () {
    this.config = stubbedRootConfig({
      default: "my-endpoint",
      "my-endpoint": {
        url: "http://bar.baz",
        secret: "fn3333",
      },
    });
    sinon.stub(ShellConfig, "read").returns(this.config);
    const { stdout } = await captureOutput(async () =>
      AddEndpointCommand.run([
        "--non-interactive",
        "foobar",
        "--url",
        "http://foo.baz",
        "--secret",
        "fn1234",
      ])
    );
    expect(stdout).to.equal(
      `Warning: could not connect to Fauna\nSaved endpoint foobar to ${rootConfigPath}\n`
    );
    expect(this.config.rootConfig).to.deep.equal({
      defaultEndpoint: "my-endpoint",
      endpoints: {
        "my-endpoint": {
          url: "http://bar.baz",
          secret: Secret.parse("fn3333"),
          name: "my-endpoint",
          // These graphql bits are only saved if they differ from the
          // default.
          graphqlHost: "graphql.fauna.com",
          graphqlPort: 443,
        },
        foobar: {
          url: "http://foo.baz",
          name: undefined,
          secret: Secret.parse("fn1234"),
          graphqlHost: "graphql.fauna.com",
          graphqlPort: 443,
        },
      },
      invalidEndpoints: [],
    });
    expect(this.config.saveRootConfig.calledOnce).to.be.true;
  });

  it("sets default endpoint", async function () {
    this.config = stubbedRootConfig({
      default: "my-endpoint",
      "my-endpoint": {
        url: "http://bar.baz",
        secret: "fn3333",
      },
    });
    sinon.stub(ShellConfig, "read").returns(this.config);
    const { stdout } = await captureOutput(async () =>
      AddEndpointCommand.run([
        "--non-interactive",
        "foobar",
        "--url",
        "http://foo.baz",
        "--secret",
        "fn1234",
        "--set-default",
      ])
    );
    expect(stdout).to.equal(
      `Warning: could not connect to Fauna\nSaved endpoint foobar to ${rootConfigPath}\n`
    );
    expect(this.config.rootConfig).to.deep.equal({
      defaultEndpoint: "foobar",
      endpoints: {
        "my-endpoint": {
          url: "http://bar.baz",
          secret: Secret.parse("fn3333"),
          name: "my-endpoint",
          // These graphql bits are only saved if they differ from the
          // default.
          graphqlHost: "graphql.fauna.com",
          graphqlPort: 443,
        },
        foobar: {
          url: "http://foo.baz",
          secret: Secret.parse("fn1234"),
          name: undefined,
          graphqlHost: "graphql.fauna.com",
          graphqlPort: 443,
        },
      },
      invalidEndpoints: [],
    });
    expect(this.config.saveRootConfig.calledOnce).to.be.true;
  });
});

describe("endpoint:list", () => {
  it("lists endpoints", async function () {
    this.config = stubbedRootConfig({
      default: "my-endpoint",
      "my-endpoint": {
        url: "http://bar.baz",
        secret: "fn3333",
      },
      "other-endpoint": {
        url: "http://bar.baz",
        secret: "fn3333",
      },
    });
    sinon.stub(ShellConfig, "read").returns(this.config);
    const { stdout } = await captureOutput(async () =>
      ListEndpointCommand.run([])
    );
    expect(stdout).to.equal(
      `Available endpoints:\n* my-endpoint\n  other-endpoint\n`
    );
    expect(this.config.saveRootConfig.calledOnce).to.be.false;
  });
});

describe("endpoint:remove", () => {
  it("removes an endpoint", async function () {
    this.config = stubbedRootConfig({
      default: "my-endpoint",
      "my-endpoint": {
        url: "http://bar.baz",
        secret: "fn3333",
      },
      "other-endpoint": {
        url: "http://bar.baz",
        secret: "fn3333",
      },
    });
    sinon.stub(ShellConfig, "read").returns(this.config);
    const { stdout } = await captureOutput(async () =>
      RemoveEndpointCommand.run(["other-endpoint"])
    );
    expect(stdout).to.equal(`Removed endpoint other-endpoint.\n`);
    expect(this.config.rootConfig).to.deep.equal({
      defaultEndpoint: "my-endpoint",
      endpoints: {
        "my-endpoint": {
          url: "http://bar.baz",
          secret: Secret.parse("fn3333"),
          name: "my-endpoint",
          // These graphql bits are only saved if they differ from the
          // default.
          graphqlHost: "graphql.fauna.com",
          graphqlPort: 443,
        },
      },
      invalidEndpoints: [],
    });
    expect(this.config.saveRootConfig.calledOnce).to.be.true;
  });

  it("clears the default if needed", async function () {
    this.config = stubbedRootConfig({
      default: "my-endpoint",
      "my-endpoint": {
        url: "http://bar.baz",
        secret: "fn3333",
      },
      "other-endpoint": {
        url: "http://bar.baz",
        secret: "fn3333",
      },
    });
    sinon.stub(ShellConfig, "read").returns(this.config);
    const { stdout } = await captureOutput(async () =>
      RemoveEndpointCommand.run(["my-endpoint"])
    );
    expect(stdout).to.equal(`Removed endpoint my-endpoint.\n`);
    expect(this.config.rootConfig).to.deep.equal({
      defaultEndpoint: undefined,
      endpoints: {
        "other-endpoint": {
          url: "http://bar.baz",
          secret: Secret.parse("fn3333"),
          name: "other-endpoint",
          // These graphql bits are only saved if they differ from the
          // default.
          graphqlHost: "graphql.fauna.com",
          graphqlPort: 443,
        },
      },
      invalidEndpoints: [],
    });
    expect(this.config.saveRootConfig.calledOnce).to.be.true;
  });
});

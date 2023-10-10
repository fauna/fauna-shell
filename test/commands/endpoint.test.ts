import { expect, test } from "@oclif/test";
import { ShellConfig, getRootConfigPath } from "../../src/lib/config";
import sinon, { SinonStub } from "sinon";
import AddEndpointCommand from "../../src/commands/endpoint/add";
import ListEndpointCommand from "../../src/commands/endpoint/list";
import RemoveEndpointCommand from "../../src/commands/endpoint/remove";
import { Config } from "@oclif/core";

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

describe("endpoint:add", () => {
  test
    .add("config", () =>
      stubbedRootConfig({
        default: "my-endpoint",
        "my-endpoint": {
          url: "http://bar.baz",
          secret: "fn3333",
        },
      })
    )
    .stdout()
    .do((ctx) =>
      new AddEndpointCommand(
        [
          "--non-interactive",
          "foobar",
          "--url",
          "http://foo.baz",
          "--secret",
          "fn1234",
        ],
        new Config({} as any)
      ).execute(ctx.config)
    )
    .it("adds an endpoint", (ctx) => {
      expect(ctx.stdout).to.equal(
        `Warning: could not connect to Fauna\nSaved endpoint foobar to ${rootConfigPath}\n`
      );
      expect(ctx.config.rootConfig).to.deep.equal({
        defaultEndpoint: "my-endpoint",
        endpoints: {
          "my-endpoint": {
            url: "http://bar.baz",
            secret: "fn3333",
            name: "my-endpoint",
            // These graphql bits are only saved if they differ from the
            // default.
            graphqlHost: "graphql.fauna.com",
            graphqlPort: 443,
          },
          foobar: {
            url: "http://foo.baz",
            name: undefined,
            secret: "fn1234",
            graphqlHost: "graphql.fauna.com",
            graphqlPort: 443,
          },
        },
      });
      expect(ctx.config.saveRootConfig.calledOnce).to.be.true;
    });

  test
    .add("config", () =>
      stubbedRootConfig({
        default: "my-endpoint",
        "my-endpoint": {
          url: "http://bar.baz",
          secret: "fn3333",
        },
      })
    )
    .stdout()
    .do((ctx) =>
      new AddEndpointCommand(
        [
          "--non-interactive",
          "foobar",
          "--url",
          "http://foo.baz",
          "--secret",
          "fn1234",
          "--set-default",
        ],
        new Config({} as any)
      ).execute(ctx.config)
    )
    .it("sets default endpoint", (ctx) => {
      expect(ctx.stdout).to.equal(
        `Warning: could not connect to Fauna\nSaved endpoint foobar to ${rootConfigPath}\n`
      );
      expect(ctx.config.rootConfig).to.deep.equal({
        defaultEndpoint: "foobar",
        endpoints: {
          "my-endpoint": {
            url: "http://bar.baz",
            secret: "fn3333",
            name: "my-endpoint",
            // These graphql bits are only saved if they differ from the
            // default.
            graphqlHost: "graphql.fauna.com",
            graphqlPort: 443,
          },
          foobar: {
            url: "http://foo.baz",
            secret: "fn1234",
            name: undefined,
            graphqlHost: "graphql.fauna.com",
            graphqlPort: 443,
          },
        },
      });
      expect(ctx.config.saveRootConfig.calledOnce).to.be.true;
    });
});

describe("endpoint:list", () => {
  test
    .add("config", () =>
      stubbedRootConfig({
        default: "my-endpoint",
        "my-endpoint": {
          url: "http://bar.baz",
          secret: "fn3333",
        },
        "other-endpoint": {
          url: "http://bar.baz",
          secret: "fn3333",
        },
      })
    )
    .stdout()
    .do((ctx) =>
      new ListEndpointCommand([], new Config({} as any)).execute(ctx.config)
    )
    .it("lists endpoints", (ctx) => {
      expect(ctx.stdout).to.equal(
        `Available endpoints:\n* my-endpoint\n  other-endpoint\n`
      );
      expect(ctx.config.saveRootConfig.calledOnce).to.be.false;
    });
});

describe("endpoint:remove", () => {
  test
    .add("config", () =>
      stubbedRootConfig({
        default: "my-endpoint",
        "my-endpoint": {
          url: "http://bar.baz",
          secret: "fn3333",
        },
        "other-endpoint": {
          url: "http://bar.baz",
          secret: "fn3333",
        },
      })
    )
    .stdout()
    .do((ctx) =>
      new RemoveEndpointCommand(
        ["other-endpoint"],
        new Config({} as any)
      ).execute(ctx.config)
    )
    .it("removes an endpoint", (ctx) => {
      expect(ctx.stdout).to.equal(`Removed endpoint other-endpoint.\n`);
      expect(ctx.config.rootConfig).to.deep.equal({
        defaultEndpoint: "my-endpoint",
        endpoints: {
          "my-endpoint": {
            url: "http://bar.baz",
            secret: "fn3333",
            name: "my-endpoint",
            // These graphql bits are only saved if they differ from the
            // default.
            graphqlHost: "graphql.fauna.com",
            graphqlPort: 443,
          },
        },
      });
      expect(ctx.config.saveRootConfig.calledOnce).to.be.true;
    });

  test
    .add("config", () =>
      stubbedRootConfig({
        default: "my-endpoint",
        "my-endpoint": {
          url: "http://bar.baz",
          secret: "fn3333",
        },
        "other-endpoint": {
          url: "http://bar.baz",
          secret: "fn3333",
        },
      })
    )
    .stdout()
    .do((ctx) =>
      new RemoveEndpointCommand(["my-endpoint"], new Config({} as any)).execute(
        ctx.config
      )
    )
    .it("clears the default if needed", (ctx) => {
      expect(ctx.stdout).to.equal(`Removed endpoint my-endpoint.\n`);
      expect(ctx.config.rootConfig).to.deep.equal({
        defaultEndpoint: undefined,
        endpoints: {
          "other-endpoint": {
            url: "http://bar.baz",
            secret: "fn3333",
            name: "other-endpoint",
            // These graphql bits are only saved if they differ from the
            // default.
            graphqlHost: "graphql.fauna.com",
            graphqlPort: 443,
          },
        },
      });
      expect(ctx.config.saveRootConfig.calledOnce).to.be.true;
    });
});

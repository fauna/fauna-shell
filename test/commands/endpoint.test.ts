import { expect, test } from "@oclif/test";
import { ShellConfig, getRootConfigPath } from "../../src/lib/config";
import sinon, { SinonStub } from "sinon";
import AddEndpointCommand from "../../src/commands/add-endpoint";
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

describe("add-endpoint", () => {
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
        `Saved endpoint foobar to ${rootConfigPath}\n`
      );
      expect(ctx.config.rootConfig).to.deep.equal({
        defaultEndpoint: "my-endpoint",
        endpoints: {
          "my-endpoint": {
            url: "http://bar.baz",
            secret: "fn3333",
            // These graphql bits are only saved if they differ from the
            // default.
            graphqlHost: "graphql.fauna.com",
            graphqlPort: 443,
          },
          foobar: {
            url: "http://foo.baz",
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
        `Saved endpoint foobar to ${rootConfigPath}\n`
      );
      expect(ctx.config.rootConfig).to.deep.equal({
        defaultEndpoint: "foobar",
        endpoints: {
          "my-endpoint": {
            url: "http://bar.baz",
            secret: "fn3333",
            // These graphql bits are only saved if they differ from the
            // default.
            graphqlHost: "graphql.fauna.com",
            graphqlPort: 443,
          },
          foobar: {
            url: "http://foo.baz",
            secret: "fn1234",
            graphqlHost: "graphql.fauna.com",
            graphqlPort: 443,
          },
        },
      });
      expect(ctx.config.saveRootConfig.calledOnce).to.be.true;
    });
});

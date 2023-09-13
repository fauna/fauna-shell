import { expect } from "chai";
import { ShellConfig, ShellOpts } from "../../src/lib/config";

const lookupEndpoint = (opts: ShellOpts) => {
  return new ShellConfig(opts).lookupEndpoint();
};

describe("root config", () => {
  it("works", () => {
    expect(
      lookupEndpoint({
        rootConfig: {
          default: "my-endpoint",
          "my-endpoint": {
            secret: "fn1234",
            url: "http://localhost:8443",
          },
        },
      })
    ).to.deep.contain({
      secret: "fn1234:admin",
      url: "http://localhost:8443",
    });
  });

  it("defaults endpoint", () => {
    expect(
      lookupEndpoint({
        rootConfig: {
          default: "my-endpoint",
          "my-endpoint": {
            secret: "fn1234",
          },
        },
      })
    ).to.deep.contain({
      secret: "fn1234:admin",
      url: "https://db.fauna.com",
    });
  });

  it("supports old domain args", () => {
    expect(
      lookupEndpoint({
        rootConfig: {
          default: "my-endpoint",
          "my-endpoint": {
            secret: "fn1234",
            scheme: "http",
            domain: "localhost",
            port: "8443",
          },
        },
      })
    ).to.deep.contain({
      secret: "fn1234:admin",
      url: "http://localhost:8443",
    });
  });
});

describe("root config with flags", () => {
  it("allows overriding endpoint with --endpoint", () => {
    expect(
      lookupEndpoint({
        flags: {
          endpoint: "my-endpoint-2",
        },
        rootConfig: {
          default: "my-endpoint",
          "my-endpoint": {
            secret: "fn1234",
          },
          "my-endpoint-2": {
            secret: "fn555",
          },
        },
      })
    ).to.deep.contain({
      secret: "fn555:admin",
      url: "https://db.fauna.com",
    });
  });
});

describe("local config", () => {
  it("allows choosing the endpoint through project config", () => {
    expect(
      lookupEndpoint({
        rootConfig: {
          default: "my-endpoint",
          "my-endpoint": {
            secret: "fn1234",
            url: "http://localhost:8443",
          },
          "my-endpoint-2": {
            secret: "fn555",
          },
        },
        projectConfig: {
          default: "my-app",
          stack: {
            "my-app": {
              endpoint: "my-endpoint-2",
              database: "foo",
            },
          },
        },
      })
    ).to.deep.contain({
      secret: "fn555:foo:admin",
      url: "https://db.fauna.com",
    });
  });

  it("allows adding a db scope", () => {
    expect(
      lookupEndpoint({
        rootConfig: {
          default: "my-endpoint",
          "my-endpoint": {
            secret: "fn1234",
            url: "http://localhost:8443",
          },
          "my-endpoint-2": {
            secret: "fn555",
          },
        },
        projectConfig: {
          default: "my-app",
          stack: {
            "my-app": {
              endpoint: "my-endpoint-2",
              database: "my-db",
            },
          },
        },
      })
    ).to.deep.contain({
      secret: "fn555:my-db:admin",
      url: "https://db.fauna.com",
    });
  });
});

describe("local config with flags", () => {
  it("allows overriding project endpoint through --endpoint", () => {
    expect(
      lookupEndpoint({
        flags: {
          endpoint: "my-endpoint-3",
        },
        rootConfig: {
          default: "my-endpoint",
          "my-endpoint": {
            secret: "fn1234",
            url: "http://localhost:8443",
          },
          "my-endpoint-2": {
            secret: "fn555",
          },
          "my-endpoint-3": {
            secret: "fn888",
            url: "http://localhost:10443",
          },
        },
        projectConfig: {
          default: "my-app",
          stack: {
            "my-app": {
              endpoint: "my-endpoint-2",
              database: "foo",
            },
          },
        },
      })
    ).to.deep.contain({
      secret: "fn888:foo:admin",
      url: "http://localhost:10443",
    });
  });

  it("allows overriding stack through --stack", () => {
    expect(
      lookupEndpoint({
        flags: {
          stack: "my-app-3",
        },
        rootConfig: {
          default: "my-endpoint",
          "my-endpoint": {
            secret: "fn1234",
            url: "http://localhost:8443",
          },
          "my-endpoint-2": {
            secret: "fn555",
          },
          "my-endpoint-3": {
            secret: "fn888",
            url: "http://localhost:10443",
          },
        },
        projectConfig: {
          default: "my-app",
          stack: {
            "my-app": {
              endpoint: "my-endpoint-2",
              database: "foo",
            },
            "my-app-3": {
              endpoint: "my-endpoint-3",
              database: "bar",
            },
          },
        },
      })
    ).to.deep.contain({
      secret: "fn888:bar:admin",
      url: "http://localhost:10443",
    });
  });

  it("allows overriding endpoint and database through flags", () => {
    expect(
      lookupEndpoint({
        flags: {
          stack: "my-app-3",
          endpoint: "my-endpoint-4",
        },
        rootConfig: {
          default: "my-endpoint",
          "my-endpoint": {
            secret: "fn1234",
            url: "http://localhost:8443",
          },
          "my-endpoint-2": {
            secret: "fn555",
          },
          "my-endpoint-3": {
            secret: "fn888",
            url: "http://localhost:10443",
          },
          "my-endpoint-4": {
            secret: "fn999",
            url: "http://somewhere-else:10443",
          },
        },
        projectConfig: {
          default: "my-app",
          stack: {
            "my-app": {
              endpoint: "my-endpoint-2",
              database: "somethin",
            },
            "my-app-3": {
              endpoint: "my-endpoint-3",
              database: "my-db-3",
            },
          },
        },
      })
    ).to.deep.contain({
      secret: "fn999:my-db-3:admin",
      url: "http://somewhere-else:10443",
    });
  });
});

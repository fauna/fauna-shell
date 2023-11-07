import { expect } from "chai";
import fs from "fs";
import sinon from "sinon";
import {
  ShellConfig,
  ShellOpts,
  getProjectConfigPath,
  getRootConfigPath,
} from "../../src/lib/config";
import { Secret } from "../../src/lib/secret";

const lookupEndpoint = (opts: ShellOpts & { scope?: string }) => {
  return new ShellConfig(opts).lookupEndpoint({
    scope: opts.scope,
  });
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
      secret: Secret.parse("fn1234"),
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
      secret: Secret.parse("fn1234"),
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
      secret: Secret.parse("fn1234"),
      url: "http://localhost:8443",
    });
  });

  it("supports config with endpoint nested", () => {
    expect(
      lookupEndpoint({
        rootConfig: {
          default: "other-endpoint",
          endpoint: {
            "my-endpoint": {
              secret: "fn1234",
            },
            "other-endpoint": {
              secret: "fn5678",
            },
          },
        },
      })
    ).to.deep.contain({
      secret: Secret.parse("fn5678"),
      url: "https://db.fauna.com",
    });
  });

  it("supports legacy top level endpoint", () => {
    expect(
      lookupEndpoint({
        rootConfig: {
          default: "endpoint",
          endpoint: {
            secret: "fn1234",
          },
        },
      })
    ).to.deep.contain({
      secret: Secret.parse("fn1234"),
      url: "https://db.fauna.com",
    });
  });

  it("fails to save if the root config has invalid endpoints", () => {
    const invalidConfig = new ShellConfig({
      rootConfig: {
        default: "my-endpoint",
        "my-endpoint": {
          secret: "fn1234",
          url: "http://localhost:8443",
        },
        invalidEndpoints: ["invalid-endpoint"],
      },
    });
    const expectedMsg = `The following endpoint definitions in ${getRootConfigPath()} are invalid:\n ${invalidConfig.rootConfig.invalidEndpoints.join(
      "\n"
    )}\n Resolve them by ensuring they have a secret defined or remove them if they are not needed.`;
    expect(() => invalidConfig.saveRootConfig()).to.throw(expectedMsg);
  });
  it("writes correct ini config", () => {
    const config = new ShellConfig({
      rootConfig: {
        default: "my-endpoint",
        "my-endpoint": {
          secret: "fn1234",
          url: "http://localhost:8443",
        },
      },
    });
    expect(config.rootConfig.toIni()).to.deep.equal({
      default: "my-endpoint",
      endpoint: {
        "my-endpoint": {
          secret: "fn1234",
          url: "http://localhost:8443",
        },
      },
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
      secret: Secret.parse("fn555"),
      url: "https://db.fauna.com",
    });
  });

  it("allows overriding secret with --secret", () => {
    expect(
      lookupEndpoint({
        flags: {
          secret: "fn555",
        },
        rootConfig: {
          default: "my-endpoint",
          "my-endpoint": {
            secret: "fn1234",
          },
        },
      })
    ).to.deep.contain({
      secret: {
        key: "fn555",
        allowDatabase: true,
        databaseScope: [],
      },
      url: "https://db.fauna.com",
    });
  });

  it("disallows scoped secrets", () => {
    expect(
      lookupEndpoint({
        flags: {
          secret: "fn555:db:@role/bar",
        },
        rootConfig: {
          default: "my-endpoint",
          "my-endpoint": {
            secret: "fn1234",
          },
        },
      })
    ).to.deep.contain({
      secret: {
        key: "fn555:db:@role/bar",
        allowDatabase: false,
        databaseScope: [],
      },
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
          environment: {
            "my-app": {
              endpoint: "my-endpoint-2",
              database: "foo",
            },
          },
        },
      })
    ).to.deep.contain({
      secret: Secret.parse("fn555").appendScope("foo"),
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
          environment: {
            "my-app": {
              endpoint: "my-endpoint-2",
              database: "my-db",
            },
          },
        },
      })
    ).to.deep.contain({
      secret: Secret.parse("fn555").appendScope("my-db"),
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
          environment: {
            "my-app": {
              endpoint: "my-endpoint-2",
              database: "foo",
            },
          },
        },
      })
    ).to.deep.contain({
      secret: Secret.parse("fn888").appendScope("foo"),
      url: "http://localhost:10443",
    });
  });

  it("allows overriding environment through --environment", () => {
    expect(
      lookupEndpoint({
        flags: {
          environment: "my-app-3",
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
          environment: {
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
      secret: Secret.parse("fn888").appendScope("bar"),
      url: "http://localhost:10443",
    });
  });

  it("allows overriding endpoint and database through flags", () => {
    expect(
      lookupEndpoint({
        flags: {
          environment: "my-app-3",
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
          environment: {
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
      secret: Secret.parse("fn999").appendScope("my-db-3"),
      url: "http://somewhere-else:10443",
    });
  });

  it("scope from args works", () => {
    expect(
      lookupEndpoint({
        flags: {},
        rootConfig: {
          default: "my-endpoint",
          "my-endpoint": {
            secret: "fn1234",
            url: "http://localhost:8443",
          },
        },
        scope: "my-scope",
      })
    ).to.deep.contain({
      secret: Secret.parse("fn1234").appendScope("my-scope"),
      url: "http://localhost:8443",
    });
  });

  it("concats scope from args and environment", () => {
    expect(
      lookupEndpoint({
        flags: {},
        rootConfig: {
          default: "my-endpoint",
          "my-endpoint": {
            secret: "fn1234",
            url: "http://localhost:8443",
          },
        },
        projectConfig: {
          default: "my-app",
          environment: {
            "my-app": {
              endpoint: "my-endpoint",
              database: "my-db",
            },
          },
        },
        scope: "my-scope",
      })
    ).to.deep.contain({
      secret: Secret.parse("fn1234").appendScope("my-db/my-scope"),
      url: "http://localhost:8443",
    });
  });
});

describe("getProjectConfigPath", () => {
  it("searches cwd for a config", () => {
    sinon.replace(process, "cwd", sinon.fake.returns("/foo/bar/baz"));

    const stat = sinon.stub(fs, "statSync");
    stat
      .withArgs("/foo/bar/baz/.fauna-project", { throwIfNoEntry: false })
      .returns({
        isFile: () => true,
      } as any);

    expect(getProjectConfigPath()).to.equal("/foo/bar/baz/.fauna-project");
    expect(stat.callCount).to.equal(1);

    sinon.restore();
  });

  it("searches upwards for a config", () => {
    sinon.replace(process, "cwd", sinon.fake.returns("/foo/bar/baz"));

    const stat = sinon.stub(fs, "statSync");
    stat
      .withArgs("/foo/bar/baz/.fauna-project", { throwIfNoEntry: false })
      .returns(undefined)
      .withArgs("/foo/bar/.fauna-project", { throwIfNoEntry: false })
      .returns({
        isFile: () => true,
      } as any);

    expect(getProjectConfigPath()).to.equal("/foo/bar/.fauna-project");
    expect(stat.callCount).to.equal(2);

    sinon.restore();
  });

  it("stops searching after finding the root", () => {
    sinon.replace(process, "cwd", sinon.fake.returns("/foo/bar/baz"));

    const stat = sinon.stub(fs, "statSync");
    stat
      .withArgs("/foo/bar/baz/.fauna-project", { throwIfNoEntry: false })
      .returns(undefined)
      .withArgs("/foo/bar/.fauna-project", { throwIfNoEntry: false })
      .returns(undefined)
      .withArgs("/foo/.fauna-project", { throwIfNoEntry: false })
      .returns(undefined)
      .withArgs("/.fauna-project", { throwIfNoEntry: false })
      .returns(undefined);

    expect(getProjectConfigPath()).to.equal(undefined);
    expect(stat.callCount).to.equal(4);

    sinon.restore();
  });

  it("fails silently if the CWD couldn't be found", () => {
    sinon.replace(process, "cwd", sinon.fake.throws(new Error("No CWD")));

    expect(getProjectConfigPath()).to.equal(undefined);

    sinon.restore();
  });

  it("explodes if `stat` fails", () => {
    sinon.replace(process, "cwd", sinon.fake.returns("/foo/bar/baz"));

    const stat = sinon.stub(fs, "statSync");
    stat
      .withArgs("/foo/bar/baz/.fauna-project", { throwIfNoEntry: false })
      .throws(new Error("Couldn't stat"));

    expect(() => getProjectConfigPath()).to.throw("Couldn't stat");

    sinon.restore();
  });
});

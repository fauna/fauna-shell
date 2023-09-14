import fs from "fs";
import { expect } from "chai";
import {
  ShellConfig,
  ShellOpts,
  getProjectConfigPath,
} from "../../src/lib/config";
import sinon from "sinon";

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
      secret: "fn1234",
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
      secret: "fn1234",
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
      secret: "fn1234",
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
      secret: "fn555",
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
      secret: "fn555:foo",
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
      secret: "fn555:my-db",
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
      secret: "fn888:foo",
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
      secret: "fn888:bar",
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
      secret: "fn999:my-db-3",
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
      secret: "fn1234:my-scope",
      url: "http://localhost:8443",
    });
  });

  it("concats scope from args and stack", () => {
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
          stack: {
            "my-app": {
              endpoint: "my-endpoint",
              database: "my-db",
            },
          },
        },
        scope: "my-scope",
      })
    ).to.deep.contain({
      secret: "fn1234:my-db/my-scope",
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

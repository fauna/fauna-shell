const { expect, test } = require("@oclif/test");
const sinon = require("sinon");
const fs = require("fs");
const ini = require("ini");
const { getConfigFile } = require("../../src/lib/misc");

const configMock = {
  default: "local",
  cloud: {
    domain: "db.fauna.com",
    scheme: "https",
    secret: "secret",
    graphqlHost: "graphql.fauna.com",
  },
  local: {
    domain: "127.0.0.1",
    scheme: "http",
    secret: "secret",
    graphqlHost: "127.0.0.1",
  },
};

describe("endpoints", () => {
  const originalReadFile = fs.readFile;
  const originalWriteFile = fs.writeFile;

  test
    .stub(fs, "readFile", (file, enc, cb) => {
      if (file !== getConfigFile()) return originalReadFile(file, enc, cb);
      cb(null, ini.encode(configMock));
    })
    .stdout()
    .command(["list-endpoints"])
    .it("runs list-endpoints", (ctx) => {
      expect(ctx.stdout).to.contain("cloud\nlocal *\n");
    });

  test
    .stub(fs, "readFile", (file, enc, cb) => {
      if (file !== getConfigFile()) return originalReadFile(file, enc, cb);
      cb(null, ini.encode({}));
    })
    .stdout()
    .command(["list-endpoints"])
    .catch((err) => {
      expect(err.message).to.contain("No endpoints defined");
    })
    .it("runs list-endpoints when no endpoints defined");

  test
    .stub(fs, "readFile", (file, enc, cb) => {
      if (file !== getConfigFile()) return originalReadFile(file, enc, cb);
      cb(null, ini.encode(configMock));
    })
    .stub(
      fs,
      "writeFile",
      sinon.stub().callsFake((file, data, opt, cb) => {
        if (file !== getConfigFile())
          return originalWriteFile(file, data, opt, cb);
        cb();
      })
    )
    .nock("http://test:443", (api) =>
      api.persist().head("/").reply(200, {}, { "x-faunadb-build": true })
    )
    .stdout()
    .command([
      "add-endpoint",
      "http://test:443/",
      "--alias",
      "test",
      "--key",
      "secret",
    ])
    .it("runs add-endpoint", () => {
      expect(fs.writeFile.getCall(0).args[1]).to.equal(
        ini.encode({
          ...configMock,
          test: {
            domain: "test",
            port: 443,
            scheme: "http",
            secret: "secret",
          },
        })
      );
    });
});

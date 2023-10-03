const { expect, test } = require("@oclif/test");
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
});

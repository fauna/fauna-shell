import { expect } from "chai";
import { runCommand } from "@oclif/test";
import nock from "nock";
const {
  withOpts,
  getEndpoint,
  evalV10,
  matchFqlReq,
  withLegacyOpts,
} = require("../helpers/utils.js");
const { query: q } = require("faunadb");

describe("eval", () => {
  it("runs eval on root db", async () => {
    const scope = nock(getEndpoint(), { allowUnmocked: true });
    mockQuery(scope);
    const { stdout } = await runCommand(
      withOpts([
        "eval",
        "--version",
        "4",
        "--format",
        "json",
        "Paginate(Collections())",
      ])
    );
    expect(JSON.parse(stdout).data[0].targetDb).to.equal("root");
  });

  it("works with legacy --domain, --schema, and --port opts", async () => {
    const scope = nock(getEndpoint(), { allowUnmocked: true });
    mockQuery(scope);
    const { stdout } = await runCommand(
      withLegacyOpts([
        "eval",
        "--version",
        "4",
        "--format",
        "json",
        "Paginate(Collections())",
      ])
    );
    expect(JSON.parse(stdout).data[0].targetDb).to.equal("root");
  });

  it("runs eval on nested db", async () => {
    const scope = nock(getEndpoint(), { allowUnmocked: true });
    scope
      .post("/", matchFqlReq(q.Exists(q.Database("nested"))))
      .reply(200, { resource: true });
    mockQuery(scope);

    const { stdout } = await runCommand(
      withOpts([
        "eval",
        "--version",
        "4",
        "--format",
        "json",
        "nested",
        "Paginate(Collections())",
      ])
    );
    expect(JSON.parse(stdout).data[0].targetDb).to.equal("nested");
  });

  it("Exits with non-zero code when the command fails", async () => {
    await runCommand(
      withOpts(["eval", "--version", "4", '[Add(1, 2), Abort("boom")]'])
    ).catch((e) => {
      expect(e.exitCode).to.equal(1);
    });
  });

  it("It pretty-prints an error message the command fails", async () => {
    await runCommand(
      withOpts(["eval", "--version", "4", '[Add(1, 2), Abort("boom")]'])
    ).catch((e) => {
      expect(e.message).to.contain("transaction aborted");
    });
  });

  it("410 from core displays core error message", async () => {
    nock(getEndpoint(), { allowUnmocked: true })
      .post("/", matchFqlReq(q.Now()))
      .reply(410, {
        errors: [{ description: "v4 error message from core" }],
      });
    await runCommand(withOpts(["eval", "--version", "4", "1"])).catch((e) => {
      expect(e.message).to.contain("v4 error message from core");
    });
  });
});

describe("eval in v10", () => {
  it("runs eval", async () => {
    const { stdout } = await runCommand(
      withOpts([
        "eval",
        "\"{ exists: Collection.byName('doesnt_exist').exists() }\"",
      ])
    );
    expect(stdout).to.equal("{\n  exists: false\n}\n");
  });

  it("runs eval in json format", async () => {
    const { stdout } = await runCommand(
      withOpts([
        "eval",
        "\"{ exists: Collection.byName('doesnt_exist').exists() }\"",
        "--format",
        "json",
      ])
    );
    expect(JSON.parse(stdout)).to.deep.equal({ exists: false });
  });

  it("runs eval in json simple format", async () => {
    const { stdout } = await runCommand(
      withOpts(["eval", '"{ two: 2 }"', "--format", "json"])
    );
    expect(JSON.parse(stdout)).to.deep.equal({ two: 2 });
  });

  it("runs eval in json tagged format", async () => {
    const { stdout } = await runCommand(
      withOpts(["eval", '"{ two: 2 }"', "--format", "json-tagged"])
    );
    expect(JSON.parse(stdout)).to.deep.equal({ two: { "@int": "2" } });
  });

  it("allows setting --secret and scope", async () => {
    await evalV10("Database.create({ name: 'MyDB' })");
    const { stdout } = await runCommand(
      withOpts(["eval", "MyDB", '"{ three: 3 }"', "--format", "json-tagged"])
    );
    expect(JSON.parse(stdout)).to.deep.equal({ three: { "@int": "3" } });
  });

  it("allows scoped secrets", async () => {
    await evalV10("Database.create({ name: 'MyDB' })");
    const { stdout } = await runCommand([
      "eval",
      '"{ two: 3 }"',
      "--format",
      "json-tagged",
      "--secret",
      `${process.env.FAUNA_SECRET}:MyDB:admin`,
      "--url",
      getEndpoint(),
    ]);
    expect(JSON.parse(stdout)).to.deep.equal({ two: { "@int": "3" } });
  });

  it("disallows scoped secrets and a scope argument", async () => {
    await evalV10("Database.create({ name: 'MyDB' })");
    await runCommand([
      "eval",
      "MyDB2",
      '"{ two: 3 }"',
      "--format",
      "json-tagged",
      "--secret",
      `${process.env.FAUNA_SECRET}:MyDB:admin`,
      "--url",
      getEndpoint(),
    ]).catch((e) => {
      expect(e.message).to.equal(
        "Cannot specify database with a secret that contains a database"
      );
    });
  });
});

function mockQuery(api) {
  api
    .persist()
    .post("/", matchFqlReq(q.Now()))
    .reply(200, { resource: new Date() })
    .post("/", matchFqlReq(q.Paginate(q.Collections())))
    .reply(200, function () {
      const auth = this.req.headers.authorization.split(" ")[1].split(":");
      return {
        resource: {
          data: [
            {
              targetDb: auth[1] ?? "root",
            },
          ],
        },
      };
    });
}

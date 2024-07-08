const { expect, test } = require("@oclif/test");
const {
  withOpts,
  getEndpoint,
  evalV10,
  matchFqlReq,
  withLegacyOpts,
} = require("../helpers/utils.js");
const { query: q } = require("faunadb");

describe("eval", () => {
  test
    .nock(getEndpoint(), { allowUnmocked: true }, mockQuery)
    .stdout()
    .command(
      withOpts([
        "eval",
        "--version",
        "4",
        "--format",
        "json",
        "Paginate(Collections())",
      ])
    )
    .it("runs eval on root db", (ctx) => {
      expect(JSON.parse(ctx.stdout).data[0].targetDb).to.equal("root");
    });

  test
    .nock(getEndpoint(), { allowUnmocked: true }, mockQuery)
    .stdout()
    .command(
      withLegacyOpts([
        "eval",
        "--version",
        "4",
        "--format",
        "json",
        "Paginate(Collections())",
      ])
    )
    .it("works with legacy --domain, --schema, and --port opts", (ctx) => {
      expect(JSON.parse(ctx.stdout).data[0].targetDb).to.equal("root");
    });

  test
    .nock(getEndpoint(), { allowUnmocked: true }, (api) => {
      api
        .post("/", matchFqlReq(q.Exists(q.Database("nested"))))
        .reply(200, { resource: true });
      mockQuery(api);
    })
    .stdout()
    .command(
      withOpts([
        "eval",
        "--version",
        "4",
        "--format",
        "json",
        "nested",
        "Paginate(Collections())",
      ])
    )
    .it("runs eval on nested db", (ctx) => {
      expect(JSON.parse(ctx.stdout).data[0].targetDb).to.equal("nested");
    });

  test
    .stderr()
    .command(withOpts(["eval", "--version", "4", '[Add(1, 2), Abort("boom")]']))
    .exit(1)
    .it("Exits with non-zero code when the command fails");

  test
    .stderr()
    .command(withOpts(["eval", "--version", "4", '[Add(1, 2), Abort("boom")]']))
    .catch((e) => {
      expect(e.message).to.contain("transaction aborted");
    })
    .it("It pretty-prints an error message the command fails");

  test
    .nock(getEndpoint(), { allowUnmocked: true }, (api) => {
      api.post("/", matchFqlReq(q.Now())).reply(410, {
        errors: [{ description: "v4 error message from core" }],
      });
    })
    .stderr()
    .command(withOpts(["eval", "--version", "4", "1"]))
    .catch((e) => {
      expect(e.message).to.contain("v4 error message from core");
    })
    .it("410 from core displays core error message");
});

describe("eval in v10", () => {
  test
    .stdout()
    .command(
      withOpts([
        "eval",
        "{ exists: Collection.byName('doesnt_exist').exists() }",
      ])
    )
    .it("runs eval", (ctx) => {
      expect(ctx.stdout).to.equal("{\n  exists: false\n}\n");
    });

  test
    .stdout()
    .command(
      withOpts([
        "eval",
        "{ exists: Collection.byName('doesnt_exist').exists() }",
        "--format",
        "json",
      ])
    )
    .it("runs eval in json format", (ctx) => {
      expect(JSON.parse(ctx.stdout)).to.deep.equal({ exists: false });
    });

  test
    .stdout()
    .command(withOpts(["eval", "{ two: 2 }", "--format", "json"]))
    .it("runs eval in json simple format", (ctx) => {
      expect(JSON.parse(ctx.stdout)).to.deep.equal({ two: 2 });
    });

  test
    .stdout()
    .command(withOpts(["eval", "{ two: 2 }", "--format", "json-tagged"]))
    .it("runs eval in json tagged format", (ctx) => {
      expect(JSON.parse(ctx.stdout)).to.deep.equal({ two: { "@int": "2" } });
    });

  test
    .do(async () => {
      // This can fail if `MyDB` already exists, but thats fine.
      await evalV10("Database.create({ name: 'MyDB' })");
    })
    .stdout()
    // --secret is passed by withOpts, and passing a scope with that is allowed.
    .command(
      withOpts(["eval", "MyDB", "{ three: 3 }", "--format", "json-tagged"])
    )
    .it("allows setting --secret and scope", (ctx) => {
      expect(JSON.parse(ctx.stdout)).to.deep.equal({ three: { "@int": "3" } });
    });

  test
    .do(async () => {
      // This can fail if `MyDB` already exists, but thats fine.
      await evalV10("Database.create({ name: 'MyDB' })");
    })
    .stdout()
    // a scoped secret is never valid.
    .command([
      "eval",
      "{ two: 3 }",
      "--format",
      "json-tagged",
      "--secret",
      `${process.env.FAUNA_SECRET}:MyDB:admin`,
      "--url",
      getEndpoint(),
    ])
    .it("allows scoped secrets", (ctx) => {
      expect(JSON.parse(ctx.stdout)).to.deep.equal({ two: { "@int": "3" } });
    });

  test
    .do(async () => {
      // This can fail if `MyDB` already exists, but thats fine.
      await evalV10("Database.create({ name: 'MyDB' })");
    })
    .stdout()
    // a scoped secret is never valid.
    .command([
      "eval",
      "MyDB2",
      "{ two: 3 }",
      "--format",
      "json-tagged",
      "--secret",
      `${process.env.FAUNA_SECRET}:MyDB:admin`,
      "--url",
      getEndpoint(),
    ])
    .catch((e) => {
      expect(e.message).to.equal(
        "Cannot specify database with a secret that contains a database"
      );
    })
    .it("disallows scoped secrets and a scope argument");
});

function mockQuery(api) {
  api
    .persist()
    .post("/", matchFqlReq(q.Now()))
    .reply(200, { resource: new Date() })
    .post("/", matchFqlReq(q.Paginate(q.Collections())))
    .reply(200, function () {
      const auth = this.req.headers.authorization[0].split(":");
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

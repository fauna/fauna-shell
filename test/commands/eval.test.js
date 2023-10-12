const { expect, test } = require("@oclif/test");
const { withOpts, getEndpoint, evalV10, matchFqlReq, withLegacyOpts } = require("../helpers/utils.js");
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
    .command(withOpts(["eval", "MyDB", "{ three: 3 }", "--format", "json-tagged"]))
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
      `foo:MyDB`,
      "--url",
      getEndpoint()
    ])
    .catch((e) => {
      expect(e.message).to.equal("Secret cannot be scoped");
    })
    .it("disallows scoped secrets");
});

function mockQuery(api) {
  api
    .persist()
    .post("/", matchFqlReq(q.Now()))
    .reply(200, { resource: new Date() })
    .post("/", matchFqlReq(q.Paginate(q.Collections())))
    .reply(200, function() {
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

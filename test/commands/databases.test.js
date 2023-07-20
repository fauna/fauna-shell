const { expect, test } = require("@oclif/test");
const { query: q, values } = require("faunadb");
const { withOpts, getEndpoint, matchFqlReq } = require("../helpers/utils.js");

const databases = [
  {
    name: "test",
    ref: new values.Ref("test"),
  },
  {
    name: "test2",
    ref: new values.Ref("test2"),
  },
];

describe("database test", () => {
  test
    .nock(getEndpoint(), { allowUnmocked: true }, (api) =>
      api
        .persist()
        .post("/", matchFqlReq(q.Now()))
        .reply(200, new Date())
        .post("/", matchFqlReq(q.Paginate(q.Databases(null), { size: 1000 })))
        .reply(200, { resource: { data: databases } })
    )
    .stdout()
    .command(withOpts(["list-databases"]))
    .it("runs list-databases", (ctx) => {
      expect(ctx.stdout).to.contain("listing databases\ntest\ntest2");
    });

  test
    .nock(getEndpoint(), { allowUnmocked: true }, (api) =>
      api
        .persist()
        .post("/", matchFqlReq(q.Now()))
        .reply(200, new Date())
        .post("/", matchFqlReq(q.CreateDatabase({ name: databases[0].name })))
        .reply(201, {})
    )
    .stdout()
    .command(withOpts(["create-database", databases[0].name]))
    .it("runs create-databases", (ctx) => {
      expect(ctx.stdout).to.contain(`created database ${databases[0].name}`);
    });

  test
    .nock(getEndpoint(), { allowUnmocked: true }, (api) =>
      api
        .persist()
        .post("/", matchFqlReq(q.Now()))
        .reply(200, new Date())
        .post("/", matchFqlReq(q.CreateDatabase({ name: databases[0].name })))
        .reply(400, {
          errors: [
            {
              position: ["create_database"],
              code: "instance already exists",
              description: "Database already exists.",
            },
          ],
        })
    )
    .stdout()
    .command(withOpts(["create-database", databases[0].name]))
    .catch((err) => {
      expect(err.message).to.contain(
        `Database '${databases[0].name}' already exists`
      );
      expect(err.oclif.exit).to.equal(1);
    })
    .it("runs create-database failed because of existing instance");

  test
    .nock(getEndpoint(), { allowUnmocked: true }, (api) =>
      api
        .persist()
        .post("/", matchFqlReq(q.Now()))
        .reply(200, new Date())
        .post("/", matchFqlReq(q.Delete(q.Database(databases[0].name))))
        .reply(200, {})
    )
    .stdout()
    .command(withOpts(["delete-database", databases[0].name]))
    .it("runs delete-database", (ctx) => {
      expect(ctx.stdout).to.contain(`database '${databases[0].name}' deleted`);
    });

  test
    .nock(getEndpoint(), { allowUnmocked: true }, (api) =>
      api
        .persist()
        .post("/", matchFqlReq(q.Now()))
        .reply(200, new Date())
        .post("/", matchFqlReq(q.Delete(q.Database(databases[1].name))))
        .reply(400, () => ({
          errors: [
            {
              position: ["delete"],
              code: "invalid ref",
              description: "Ref refers to undefined database 'testing'",
            },
          ],
        }))
    )
    .stdout()
    .command(withOpts(["delete-database", databases[1].name]))
    .catch((err) => {
      expect(err.message).to.contain(
        `Database '${databases[1].name}' not found`
      );
      expect(err.oclif.exit).to.equal(1);
    })
    .it("runs delete-database failed because instance not found");
});

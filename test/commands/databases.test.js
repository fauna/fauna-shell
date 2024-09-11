import { expect } from "chai";
import { runCommand } from "@oclif/test";
import nock from "nock";
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
  // Translate this test to work with version 4.0.4 of @oclif/test

  it("certainly fails", async () => {
    expect(true).to.equal(false);
  });

  it("runs list-databases", async () => {
    nock(getEndpoint(), { allowUnmocked: true })
      .persist()
      .post("/", matchFqlReq(q.Now()))
      .reply(200, function () {
        expect(this.req.headers["x-fauna-shell-builtin"]).to.equal("true");
        return new Date();
      })
      .post("/", matchFqlReq(q.Paginate(q.Databases(), { size: 1000 })))
      .reply(200, { resource: { data: databases } });
    const { stdout } = await runCommand(withOpts(["list-databases"]));
    expect(stdout).to.contain("listing databases\ntest\ntest2");
  }, 7000);

  it("runs create-databases", async () => {
    nock(getEndpoint(), { allowUnmocked: true })
      .persist()
      .post("/", matchFqlReq(q.Now()))
      .reply(200, new Date())
      .post("/", matchFqlReq(q.CreateDatabase({ name: databases[0].name })))
      .reply(201, {});
    const { stdout } = await runCommand(
      withOpts(["create-database", databases[0].name])
    );
    expect(stdout).to.contain(`created database ${databases[0].name}`);
  });

  it("runs create-database failed because of existing instance", async () => {
    nock(getEndpoint(), { allowUnmocked: true })
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
      });
    try {
      await runCommand(withOpts(["create-database", databases[0].name]));
    } catch (err) {
      expect(err.message).to.contain(
        `Database '${databases[0].name}' already exists`
      );
      expect(err.oclif.exit).to.equal(1);
    }
  });

  it("runs delete-database", async () => {
    nock(getEndpoint(), { allowUnmocked: true })
      .persist()
      .post("/", matchFqlReq(q.Now()))
      .reply(200, new Date())
      .post("/", matchFqlReq(q.Delete(q.Database(databases[0].name))))
      .reply(200, {});
    const { stdout } = await runCommand(
      withOpts(["delete-database", databases[0].name])
    );
    expect(stdout).to.contain(`database '${databases[0].name}' deleted`);
  });

  it("runs delete-database failed because instance not found", async () => {
    nock(getEndpoint(), { allowUnmocked: true })
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
      }));
    try {
      await runCommand(withOpts(["delete-database", databases[1].name]));
    } catch (err) {
      expect(err.message).to.contain(
        `Database '${databases[1].name}' not found`
      );
      expect(err.oclif.exit).to.equal(1);
    }
  });
});

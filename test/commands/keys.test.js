import { expect } from "chai";
import { runCommand } from "@oclif/test";
import nock from "nock";
const { query: q, values } = require("faunadb");
const { withOpts, getEndpoint, matchFqlReq } = require("../helpers/utils.js");

const currentKeys = {
  name: "[current]",
  keys: { data: [{ id: 1, role: "admin" }] },
};
const childrenKeys = {
  name: "nested",
  keys: { data: [{ id: 2, role: "server" }] },
};

const keyname = "296492256109527557";
const dbname = "test";

afterEach(() => {
  nock.cleanAll();
});

describe("keys test", () => {
  it("runs list-keys", async function () {
    nock(getEndpoint(), { allowUnmocked: true })
      .persist()
      .post("/", matchFqlReq(q.Now()))
      .reply(200, function () {
        expect(this.req.headers["x-fauna-shell-builtin"]).to.equal("true");
        return new Date();
      })
      .post("/", matchFqlReq(q.Paginate(q.Keys(), { size: 100 })))
      .reply(200, { resource: currentKeys })
      .post("/", matchFqlReq(q.Paginate(q.Databases(), { size: 100 })))
      .reply(200, { resource: { data: [childrenKeys] } });

    const { stdout } = await runCommand(withOpts(["list-keys"]));
    const lines = stdout.split("\n");
    lines.splice(0, 1);
    const output_keys = lines.map((l) => l.replace(/ /g, ""));
    expect(output_keys).to.include.members([
      ...currentKeys.keys.data.map(
        ({ id, role }) => `${id}${currentKeys.name}${role}`
      ),
      ...childrenKeys.keys.data.map(
        ({ id, role }) => `${id}${childrenKeys.name}${role}`
      ),
    ]);
  });

  it("runs create-key for non exists db", async () => {
    nock(getEndpoint(), { allowUnmocked: true })
      .persist()
      .post("/", matchFqlReq(q.Now()))
      .reply(200, new Date())
      .post("/", matchFqlReq(q.Exists(q.Database(dbname))))
      .reply(200, { resource: false });

    const { error } = await runCommand(withOpts(["create-key", dbname]));

    expect(error.message).to.contain(`Database '${dbname}' doesn't exist`);
    expect(error.oclif.exit).to.equal(1);
  });

  it("runs create-key testdb", async () => {
    const scope = nock(getEndpoint(), { allowUnmocked: true });
    mockCreateKey(scope, { role: "admin" });
    const { stdout } = await runCommand(withOpts(["create-key", dbname]));
    expect(stdout).to.contain(
      `created key for database '${dbname}' with role 'admin'.`
    );
  });

  it("runs create-key testdb with a different role", async () => {
    const scope = nock(getEndpoint(), { allowUnmocked: true });
    mockCreateKey(scope, { role: "server" });

    const { stdout } = await runCommand(
      withOpts(["create-key", dbname, "server"])
    );

    expect(stdout).to.contain(
      `created key for database '${dbname}' with role 'server'.`
    );
  });

  it("runs create-key testdb with a wrong role", async () => {
    const { error } = await runCommand(
      withOpts(["create-key", dbname, "other"])
    );

    expect(error.message).to.contain("Expected other to be one of");
    expect(error.oclif.exit).to.not.equal(0);
  });

  it("runs delete-key", async () => {
    nock(getEndpoint(), { allowUnmocked: true })
      .persist()
      .post("/", matchFqlReq(q.Now()))
      .reply(200, new Date())
      .post("/", matchFqlReq(q.Delete(q.Ref(q.Keys(null), keyname))))
      .reply(200, { resource: { ref: new values.Ref(keyname) } });

    const { stdout } = await runCommand(withOpts(["delete-key", keyname]));
    expect(stdout).to.contain(`key ${keyname} deleted`);
  });

  it("runs delete-key for not exist key", async () => {
    nock(getEndpoint(), { allowUnmocked: true })
      .persist()
      .post("/", matchFqlReq(q.Now()))
      .reply(200, new Date())
      .post("/", matchFqlReq(q.Delete(q.Ref(q.Keys(null), keyname))))
      .reply(400, {
        errors: [
          {
            position: [],
            code: "instance not found",
            description: "Key not found.",
          },
        ],
      });

    const { error } = await runCommand(withOpts(["delete-key", keyname]));

    expect(error.message).to.contain(`Key ${keyname} not found`);
  });
});

function mockCreateKey(api, { role }) {
  api
    .persist()
    .post("/", matchFqlReq(q.Exists(q.Database(dbname))))
    .reply(200, { resource: true })
    .post("/", matchFqlReq(q.Now()))
    .reply(200, new Date())
    .post("/", matchFqlReq(q.CreateKey({ role })))
    .reply(function (_, reqBody) {
      const { role } = JSON.parse(reqBody).create_key.object;
      const authParsed = this.req.headers.authorization
        .split(" ")[1]
        .split(":");
      expect(this.req.headers["x-fauna-shell-builtin"]).to.equal("true");
      const allowedRoles = ["admin", "server", "server-readonly", "client"];
      if (allowedRoles.includes(role)) {
        return [
          200,
          {
            resource: {
              role,
              database: new values.Ref(authParsed[1]),
            },
          },
        ];
      }

      return [400, {}];
    });
}

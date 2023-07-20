const { expect, test } = require("@oclif/test");
const { query: q } = require("faunadb");
const { withOpts, getEndpoint, matchFqlReq } = require("../helpers/utils.js");
const { ux } = require("@oclif/core");

const files = {
  version: 0,
  files: [
    { filename: "main.fsl" },
    { filename: "functions.fsl" },
    { filename: "legacy.json" },
  ],
};

const main = {
  version: 0,
  content: "collection foo {}\n\nfunction bar(x, y) { x + y }\n",
};

const diff = {
  version: 0,
  diff: "main.fsl ADD collection foo",
};

describe("fauna schema:ls test", () => {
  test
    .nock(getEndpoint(), { allowUnmocked: false }, (api) =>
      api
        .persist()
        .post("/", matchFqlReq(q.Now()))
        .reply(200, new Date())
        .get("/schema/1/files")
        .reply(200, files)
    )
    .stdout()
    .command(withOpts(["schema:ls"]))
    .it("runs schema:ls", (ctx) => {
      expect(ctx.stdout).to.contain(
        "Schema files:\n\nmain.fsl\nfunctions.fsl\nlegacy.json"
      );
    });
});

describe("fauna schema:pull test", () => {
  test
    .nock(getEndpoint(), { allowUnmocked: false }, (api) =>
      api
        .persist()
        .post("/", matchFqlReq(q.Now()))
        .reply(200, new Date())
        .get("/schema/1/files/main.fsl")
        .reply(200, main)
    )
    .stdout()
    .command(withOpts(["schema:pull", "main.fsl"]))
    .it("runs schema:pull", (ctx) => {
      expect(ctx.stdout).to.contain(`${main.content}`);
    });
});

describe("fauna schema:push test", () => {
  test
    .stub(ux, "confirm", () => async () => true)
    .nock(getEndpoint(), { allowUnmocked: false }, (api) =>
      api
        .persist()
        .post("/", matchFqlReq(q.Now()))
        .reply(200, new Date())
        .post("/schema/1/validate")
        .reply(200, diff)
        .post("/schema/1/update?version=0")
        .reply(200)
    )
    .stdout()
    .command(withOpts(["schema:push", "main.fsl"]))
    .it("runs schema:push", (ctx) => {
      expect(ctx.stdout).to.contain(`${diff.diff}`);
    });
});

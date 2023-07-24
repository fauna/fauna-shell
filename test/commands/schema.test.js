const { expect, test } = require("@oclif/test");
const { query: q } = require("faunadb");
const { withOpts, getEndpoint, matchFqlReq } = require("../helpers/utils.js");

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

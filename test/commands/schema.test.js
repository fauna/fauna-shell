const fs = require("fs");
const path = require("path");
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

const functions = {
  version: 0,
  content: "function id(x) { x }",
};

const diff = {
  version: 0,
  diff: "main.fsl ADD collection foo",
};

const pullfiles = {
  version: 0,
  files: [{ filename: "main.fsl" }, { filename: "functions.fsl" }],
};

const updated = { version: 1 };

describe("fauna schema ls test", () => {
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
    .command(withOpts(["schema ls"]))
    .it("runs schema ls", (ctx) => {
      expect(ctx.stdout).to.contain(
        "Schema files:\n\nmain.fsl\nfunctions.fsl\nlegacy.json"
      );
    });
});

describe("fauna schema cat test", () => {
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
    .command(withOpts(["schema cat", "main.fsl"]))
    .it("runs schema cat", (ctx) => {
      expect(ctx.stdout).to.contain(`${main.content}`);
    });
});

describe("fauna schema push test", () => {
  test
    .stub(ux, "confirm", () => async () => true)
    .nock(getEndpoint(), { allowUnmocked: false }, (api) =>
      api
        .persist()
        .post("/", matchFqlReq(q.Now()))
        .reply(200, new Date())
        .post("/schema/1/validate?force=true")
        .reply(200, diff)
        .post("/schema/1/update?version=0")
        .reply(200, updated)
    )
    .stdout()
    .command(withOpts(["schema push", "--dir=test/testdata"]))
    .it("runs schema push", (ctx) => {
      expect(ctx.stdout).to.contain(`${diff.diff}`);
    });
});

const testdir = "test/testdata";

const setup = () => {
  try {
    fs.unlinkSync(path.join(testdir, "functions.fsl"));
  } catch (err) {
    // 2023 technology.
    if (err.code === "ENOENT") {
      // OK.
    } else {
      throw err;
    }
  }
  fs.writeFileSync(path.join(testdir, "main.fsl"), "collection Nope { }");
  fs.writeFileSync(path.join(testdir, "extra.fsl"), "baaaaa");
};

for (const retain of [true, false]) {
  describe(`fauna schema pull test (retain=${retain})`, () => {
    let cmd = ["schema pull", `--dir=${testdir}`];
    if (retain) {
      cmd = ["schema pull", `--dir=${testdir}`, "--retain"];
    }
    setup();
    test
      .nock(getEndpoint(), { allowUnmocked: false }, (api) =>
        api
          .persist()
          .post("/", matchFqlReq(q.Now()))
          .reply(200, new Date())
          .get("/schema/1/files")
          .reply(200, pullfiles)
          .get("/schema/1/files/functions.fsl")
          .reply(200, functions)
          .get("/schema/1/files/main.fsl")
          .reply(200, main)
      )
      .stdout()
      .command(withOpts(cmd))
      .it("runs schema pull", (ctx) => {
        expect(ctx.stdout).to.contain("");
        expect(
          fs.readFileSync(path.join(testdir, "functions.fsl"), "utf8")
        ).to.equal(functions.content);
        expect(
          fs.readFileSync(path.join(testdir, "main.fsl"), "utf8")
        ).to.equal(main.content);
        expect(
          fs.statSync(path.join(testdir, "no.fsl")).isDirectory()
        ).to.equal(true);
        expect(fs.statSync(path.join(testdir, "nofsl")).isDirectory()).to.equal(
          true
        );
        expect(
          fs.statSync(path.join(testdir, "main.notfsl")).isFile()
        ).to.equal(true);
        if (retain) {
          expect(
            fs.statSync(path.join(testdir, "extra.fsl")).isFile()
          ).to.equal(true);
        } else {
          // 2023 error handling technology.
          try {
            fs.statSync(path.join(testdir, "extra.fsl"));
            expect(0).to.equal(1);
          } catch (err) {
            expect(err.code).to.equal("ENOENT");
          }
        }
      });
  });
}
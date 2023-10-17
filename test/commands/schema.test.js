const inquirer = require("@inquirer/prompts");
const fs = require("fs");
const path = require("path");
const { expect, test } = require("@oclif/test");
const { query: q } = require("faunadb");
const { withOpts, getEndpoint, matchFqlReq } = require("../helpers/utils.js");

const main = {
  version: 0,
  content: "collection foo {}\n\nfunction bar(x, y) { x + y }\n",
};

const functions = {
  version: 0,
  content: "function id(x) { x }",
};

const myrole = {
  version: 0,
  content: "role myrole { }",
};

const diff = {
  version: 0,
  diff: "main.fsl ADD collection foo",
};

const pullfiles = {
  version: 0,
  files: [
    { filename: "main.fsl" },
    { filename: "functions.fsl" },
    { filename: "roles/myrole.fsl" },
  ],
};

const updated = { version: 1 };

describe("fauna schema diff test", () => {
  test
    .nock(getEndpoint(), { allowUnmocked: false }, (api) =>
      api
        .persist()
        .post("/", matchFqlReq(q.Now()))
        .reply(200, new Date())
        .post("/schema/1/validate?force=true")
        .reply(200, diff)
    )
    .stdout()
    .command(withOpts(["schema diff", "--dir=test/testdata"]))
    .it("runs schema diff", (ctx) => {
      expect(ctx.stdout).to.contain(`${diff.diff}`);
    });
});

describe("fauna schema push test", () => {
  test
    .stub(inquirer, "confirm", async () => true)
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
    fs.rmSync(path.join(testdir, "roles"), { recursive: true, force: true });
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

for (const ddelete of [false, true]) {
  describe(`fauna schema pull test (delete=${ddelete})`, () => {
    let cmd = ["schema pull", `--dir=${testdir}`];
    if (ddelete) {
      cmd = ["schema pull", `--dir=${testdir}`, "--delete"];
    }
    setup();
    test
      .stub(inquirer, "confirm", async () => true)
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
          .get("/schema/1/files/roles%2Fmyrole.fsl")
          .reply(200, myrole)
      )
      .stdout()
      .command(withOpts(cmd))
      .it("runs schema pull", (ctx) => {
        expect(ctx.stdout).to.contain("Pull makes the following changes:");
        expect(
          fs.readFileSync(path.join(testdir, "functions.fsl"), "utf8")
        ).to.equal(functions.content);
        expect(
          fs.readFileSync(path.join(testdir, "main.fsl"), "utf8")
        ).to.equal(main.content);
        expect(
          fs.readFileSync(path.join(testdir, "roles", "myrole.fsl"), "utf8")
        ).to.equal(myrole.content);
        expect(
          fs.statSync(path.join(testdir, "no.fsl")).isDirectory()
        ).to.equal(true);
        expect(fs.statSync(path.join(testdir, "nofsl")).isDirectory()).to.equal(
          true
        );
        expect(
          fs.statSync(path.join(testdir, "main.notfsl")).isFile()
        ).to.equal(true);
        if (!ddelete) {
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

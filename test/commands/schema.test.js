import { expect } from "chai";
import { runCommand } from "@oclif/test";
import nock from "nock";
import sinon from "sinon";
const inquirer = require("@inquirer/prompts");
const fs = require("fs");
const path = require("path");
const { query: q } = require("faunadb");
const { withOpts, getEndpoint, matchFqlReq } = require("../helpers/utils.js");
const { disableColor } = require("../../src/lib/color");

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
  before(() => {
    disableColor();
  });

  it("runs schema diff", async () => {
    nock(getEndpoint(), { allowUnmocked: false })
      .persist()
      .post("/", matchFqlReq(q.Now()))
      .reply(200, new Date())
      .post("/schema/1/validate?force=true")
      .reply(200, diff);

    const { stdout } = await runCommand(
      withOpts(["schema diff", "--dir=test/testdata"])
    );

    expect(stdout).to.contain(`${diff.diff}`);
  });
});

describe("fauna schema push test", () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("runs schema push", async () => {
    nock(getEndpoint(), { allowUnmocked: false })
      .persist()
      .post("/", matchFqlReq(q.Now()))
      .reply(200, new Date())
      .post("/schema/1/validate?force=true")
      .reply(200, diff)
      .post("/schema/1/update?version=0")
      .reply(200, updated);
    // Stubbing the confirmation to always return true
    const stubConfirm = sinon.stub(inquirer, "confirm").resolves(true);
    const { stdout } = await runCommand(
      withOpts(["schema push", "--dir=test/testdata"])
    );
    expect(stdout).to.contain(`${diff.diff}`);
    // Restore the stub after the test
    stubConfirm.restore();
  });

  it("runs schema push --stage", async () => {
    nock(getEndpoint(), { allowUnmocked: false })
      .persist()
      .post("/", matchFqlReq(q.Now()))
      .reply(200, new Date())
      .post("/schema/1/validate?force=true")
      .reply(200, diff)
      .post("/schema/1/update?version=0&stage=true")
      .reply(200, updated);

    // Stubbing the confirmation to always return true
    const stubConfirm = sinon.stub(inquirer, "confirm").resolves(true);
    const { stdout } = await runCommand(
      withOpts(["schema push", "--dir=test/testdata", "--stage"])
    );
    expect(stdout).to.contain(`${diff.diff}`);
    // Restore the stub after the test
    stubConfirm.restore();
  });

  it("runs schema status", async () => {
    nock(getEndpoint(), { allowUnmocked: false })
      .persist()
      .post("/", matchFqlReq(q.Now()))
      .reply(200, new Date())
      .get("/schema/1/staged/status?diff=true")
      .reply(200, {
        version: 0,
        status: "ready",
        diff: diff.diff,
      });

    // Stubbing the confirmation to always return true
    const { stdout } = await runCommand(
      withOpts(["schema status", "--dir=test/testdata"])
    );
    expect(stdout).to.contain(`${diff.diff}`);
  });

  it("runs schema commit", async () => {
    nock(getEndpoint(), { allowUnmocked: false })
      .persist()
      .post("/", matchFqlReq(q.Now()))
      .reply(200, new Date())
      .get("/schema/1/staged/status?diff=true")
      .reply(200, {
        version: 3,
        status: "ready",
        diff: diff.diff,
      })
      .post("/schema/1/staged/commit?version=3")
      .reply(200, { version: 0 });

    // Stubbing the confirmation to always return true
    const stubConfirm = sinon.stub(inquirer, "confirm").resolves(true);
    const { stdout } = await runCommand(
      withOpts(["schema commit", "--dir=test/testdata"])
    );
    expect(stdout).to.contain(`Schema has been committed`);
    // Restore the stub after the test
    stubConfirm.restore();
  });

  it("won't commit when schema isn't ready", async () => {
    nock(getEndpoint(), { allowUnmocked: false })
      .persist()
      .post("/", matchFqlReq(q.Now()))
      .reply(200, new Date())
      .get("/schema/1/staged/status?diff=true")
      .reply(200, {
        version: 3,
        status: "pending",
        diff: diff.diff,
      });

    // Stubbing the confirmation to always return true
    const stubConfirm = sinon.stub(inquirer, "confirm").resolves(true);
    const { stdout, error } = await runCommand(
      withOpts(["schema commit", "--dir=test/testdata"])
    );
    expect(stdout).to.contain(diff.diff);
    expect(error.message).to.equal("Schema is not ready to be committed");
    // Restore the stub after the test
    stubConfirm.restore();
  });

  it("runs schema abandon", async () => {
    nock(getEndpoint(), { allowUnmocked: false })
      .persist()
      .post("/", matchFqlReq(q.Now()))
      .reply(200, new Date())
      .get("/schema/1/staged/status?diff=true")
      .reply(200, {
        version: 3,
        status: "ready",
        diff: diff.diff,
      })
      .post("/schema/1/staged/abandon?version=3")
      .reply(200, { version: 0 });

    // Stubbing the confirmation to always return true
    const stubConfirm = sinon.stub(inquirer, "confirm").resolves(true);
    const { stdout } = await runCommand(
      withOpts(["schema abandon", "--dir=test/testdata"])
    );
    expect(stdout).to.contain(`Schema has been abandoned`);
    // Restore the stub after the test
    stubConfirm.restore();
  });

  it("will abandon even when schema isn't ready", async () => {
    nock(getEndpoint(), { allowUnmocked: false })
      .persist()
      .post("/", matchFqlReq(q.Now()))
      .reply(200, new Date())
      .get("/schema/1/staged/status?diff=true")
      .reply(200, {
        version: 3,
        status: "pending",
        diff: diff.diff,
      })
      .post("/schema/1/staged/abandon?version=3")
      .reply(200, { version: 0 });

    // Stubbing the confirmation to always return true
    const stubConfirm = sinon.stub(inquirer, "confirm").resolves(true);
    const { stdout } = await runCommand(
      withOpts(["schema abandon", "--dir=test/testdata"])
    );
    expect(stdout).to.contain(`Schema has been abandoned`);
    // Restore the stub after the test
    stubConfirm.restore();
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
    it("runs schema pull", async () => {
      // Stubbing the confirmation to always return true
      const stubConfirm = sinon.stub(inquirer, "confirm").resolves(true);

      // Setting up the nock scope for API mocking
      nock(getEndpoint(), { allowUnmocked: false })
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
        .reply(200, myrole);

      // Running the command with options
      const { stdout } = await runCommand(withOpts(cmd));

      // Assertions
      expect(stdout).to.contain("Pull makes the following changes:");
      expect(
        fs.readFileSync(path.join(testdir, "functions.fsl"), "utf8")
      ).to.equal(functions.content);
      expect(fs.readFileSync(path.join(testdir, "main.fsl"), "utf8")).to.equal(
        main.content
      );
      expect(
        fs.readFileSync(path.join(testdir, "roles", "myrole.fsl"), "utf8")
      ).to.equal(myrole.content);
      expect(fs.statSync(path.join(testdir, "no.fsl")).isDirectory()).to.equal(
        true
      );
      expect(fs.statSync(path.join(testdir, "nofsl")).isDirectory()).to.equal(
        true
      );
      expect(fs.statSync(path.join(testdir, "main.notfsl")).isFile()).to.equal(
        true
      );

      if (!ddelete) {
        expect(fs.statSync(path.join(testdir, "extra.fsl")).isFile()).to.equal(
          true
        );
      } else {
        // Error handling for file not found
        try {
          fs.statSync(path.join(testdir, "extra.fsl"));
          expect(0).to.equal(1); // Fail the test if file exists when it should not
        } catch (err) {
          expect(err.code).to.equal("ENOENT"); // Check that the error code is 'ENOENT'
        }
      }

      // Clean up after test
      stubConfirm.restore();
    });
  });
}

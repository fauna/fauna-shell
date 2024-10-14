import { expect } from "chai";
import { runCommand } from "@oclif/test";
import nock from "nock";
import sinon from "sinon";
import * as inquirer from "@inquirer/prompts";
import fs from "fs";
import path from "path";
import { query } from "faunadb";
import { withOpts, getEndpoint, matchFqlReq } from "../helpers/utils.js";
import { disableColor } from "../../src/lib/color";

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
      .post("/", matchFqlReq(query.Now()))
      .reply(200, new Date())
      .get("/schema/1/staged/status")
      .reply(200, { status: "none", version: 0 })
      .post("/schema/1/validate?staged=true&version=0&diff=semantic")
      .reply(200, diff);

    const { stdout } = await runCommand(
      withOpts(["schema diff", "--dir=test/testdata"])
    );

    expect(stdout).to.contain(
      `Differences from the remote schema to the local schema:`
    );
    expect(stdout).to.contain(`${diff.diff}`);
  });

  it("runs schema diff when there's a staged schema", async () => {
    nock(getEndpoint(), { allowUnmocked: false })
      .persist()
      .post("/", matchFqlReq(query.Now()))
      .reply(200, new Date())
      .get("/schema/1/staged/status")
      .reply(200, { status: "ready", version: 0 })
      .post("/schema/1/validate?staged=true&version=0&diff=semantic")
      .reply(200, diff);

    const { stdout } = await runCommand(
      withOpts(["schema diff", "--dir=test/testdata"])
    );

    expect(stdout).to.contain(
      `Differences from the remote, staged schema to the local schema:`
    );
    expect(stdout).to.contain(`${diff.diff}`);
  });

  it("runs schema diff active", async () => {
    nock(getEndpoint(), { allowUnmocked: false })
      .persist()
      .post("/", matchFqlReq(query.Now()))
      .reply(200, new Date())
      .get("/schema/1/staged/status")
      .reply(200, { status: "ready", version: 0 })
      .post("/schema/1/validate?staged=false&version=0&diff=semantic")
      .reply(200, diff);

    const { stdout } = await runCommand(
      withOpts(["schema diff", "--dir=test/testdata", "active"])
    );

    expect(stdout).to.contain(
      `Differences from the remote, active schema to the local schema:`
    );
    expect(stdout).to.contain(`${diff.diff}`);
  });

  it("runs schema diff staged", async () => {
    nock(getEndpoint(), { allowUnmocked: false })
      .persist()
      .post("/", matchFqlReq(query.Now()))
      .reply(200, new Date())
      .get("/schema/1/staged/status?diff=semantic")
      .reply(200, { status: "ready", diff: diff.diff, version: 0 });

    const { stdout } = await runCommand(
      withOpts(["schema diff", "--dir=test/testdata", "staged"])
    );

    expect(stdout).to.contain(
      `Differences from the remote, active schema to the remote, staged schema:`
    );
    expect(stdout).to.contain(`${diff.diff}`);
  });
});

describe("fauna schema push test", () => {
  before(() => {
    disableColor();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it("runs schema push", async () => {
    nock(getEndpoint(), { allowUnmocked: false })
      .persist()
      .post("/", matchFqlReq(query.Now()))
      .reply(200, new Date())
      .get("/schema/1/staged/status")
      .reply(200, { status: "none", version: 0 })
      .post("/schema/1/validate?force=true&diff=summary")
      .reply(200, diff)
      .post("/schema/1/update?version=0&staged=true")
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

  it("runs schema push --active", async () => {
    nock(getEndpoint(), { allowUnmocked: false })
      .persist()
      .post("/", matchFqlReq(query.Now()))
      .reply(200, new Date())
      .get("/schema/1/staged/status")
      .reply(200, { status: "none", version: 0 })
      .post("/schema/1/validate?force=true&diff=summary")
      .reply(200, diff)
      .post("/schema/1/update?version=0&staged=false")
      .reply(200, updated);
    // Stubbing the confirmation to always return true
    const stubConfirm = sinon.stub(inquirer, "confirm").resolves(true);
    const { stdout } = await runCommand(
      withOpts(["schema push", "--dir=test/testdata", "--active"])
    );
    expect(stdout).to.contain(`${diff.diff}`);
    // Restore the stub after the test
    stubConfirm.restore();
  });

  it("runs schema status", async () => {
    nock(getEndpoint(), { allowUnmocked: false })
      .persist()
      .post("/", matchFqlReq(query.Now()))
      .reply(200, new Date())
      .get("/schema/1/staged/status?diff=summary")
      .reply(200, {
        version: 0,
        status: "ready",
        diff: diff.diff,
      })
      .post("/schema/1/validate?diff=summary&staged=true&version=0")
      .reply(200, {
        version: 0,
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
      .post("/", matchFqlReq(query.Now()))
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
      .post("/", matchFqlReq(query.Now()))
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
    expect(error?.message).to.equal("Schema is not ready to be committed");
    // Restore the stub after the test
    stubConfirm.restore();
  });

  it("runs schema abandon", async () => {
    nock(getEndpoint(), { allowUnmocked: false })
      .persist()
      .post("/", matchFqlReq(query.Now()))
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
      .post("/", matchFqlReq(query.Now()))
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
  } catch (err: any) {
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

describe(`fauna schema pull`, () => {
  for (const ddelete of [false, true]) {
    it(`runs schema pull (delete=${ddelete})`, async () => {
      let cmd = ["schema pull", `--dir=${testdir}`];
      if (ddelete) {
        cmd = ["schema pull", `--dir=${testdir}`, "--delete"];
      }
      setup();
      // Stubbing the confirmation to always return true
      const stubConfirm = sinon.stub(inquirer, "confirm").resolves(true);

      // Setting up the nock scope for API mocking
      nock(getEndpoint(), { allowUnmocked: false })
        .persist()
        .post("/", matchFqlReq(query.Now()))
        .reply(200, new Date())
        .get("/schema/1/files")
        .reply(200, pullfiles)
        .get("/schema/1/staged/status?version=0")
        .reply(200, { status: "none" })
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
        } catch (err: any) {
          expect(err.code).to.equal("ENOENT"); // Check that the error code is 'ENOENT'
        }
      }

      // Clean up after test
      stubConfirm.restore();
    });
  }

  it(`requires --staged when there's a staged schema`, async () => {
    const stubConfirm = sinon.stub(inquirer, "confirm").resolves(true);

    nock(getEndpoint(), { allowUnmocked: false })
      .persist()
      .post("/", matchFqlReq(query.Now()))
      .reply(200, new Date())
      .get("/schema/1/files")
      .reply(200, pullfiles)
      .get("/schema/1/staged/status?version=0")
      .reply(200, { status: "ready" });

    const { error } = await runCommand(
      withOpts(["schema pull", `--dir=${testdir}`])
    );
    expect(error?.message).to.equal(
      "There is a staged schema change. Use --staged to pull it."
    );

    stubConfirm.restore();
  });

  it(`disallows --staged when there's no staged schema`, async () => {
    const stubConfirm = sinon.stub(inquirer, "confirm").resolves(true);

    nock(getEndpoint(), { allowUnmocked: false })
      .persist()
      .post("/", matchFqlReq(query.Now()))
      .reply(200, new Date())
      .get("/schema/1/files")
      .reply(200, pullfiles)
      .get("/schema/1/staged/status?version=0")
      .reply(200, { status: "none" });

    const { error } = await runCommand(
      withOpts(["schema pull", `--dir=${testdir}`, `--staged`])
    );
    expect(error?.message).to.equal(
      "There are no staged schema changes to pull."
    );

    stubConfirm.restore();
  });

  it(`runs schema pull --staged`, async () => {
    const stubConfirm = sinon.stub(inquirer, "confirm").resolves(true);

    nock(getEndpoint(), { allowUnmocked: false })
      .persist()
      .post("/", matchFqlReq(query.Now()))
      .reply(200, new Date())
      .get("/schema/1/files")
      .reply(200, pullfiles)
      .get("/schema/1/staged/status?version=0")
      .reply(200, { status: "ready" })
      .get("/schema/1/files/functions.fsl")
      .reply(200, functions)
      .get("/schema/1/files/main.fsl")
      .reply(200, main)
      .get("/schema/1/files/roles%2Fmyrole.fsl")
      .reply(200, myrole);

    // This should work as normal.
    const { stdout } = await runCommand(
      withOpts(["schema pull", `--dir=${testdir}`, `--staged`])
    );
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

    stubConfirm.restore();
  });
});

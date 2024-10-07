import { expect } from "chai";

import * as awilix from "awilix/lib/awilix.module.mjs";

import { f } from "../helpers.mjs";
import tryToCatch from "try-to-catch";

import { run } from "../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../src/config/setup-test-container.mjs";
import {
  getSchemaFile,
  getSchemaFiles,
  getStagedSchemaStatus,
  getAllSchemaFileContents,
  writeSchemaFiles,
} from "../../src/lib/schema.mjs";

describe("schema pull", function () {
  let container;
  let logger;
  let confirm;
  let fetch;
  let fs;

  beforeEach(() => {
    container = setupContainer();

    // this is a funny situation - we actually want the "real" implementations of these.
    // they end up calling fetch and fs, which is what we'll verify against in the tests.
    container.register({
      getSchemaFile: awilix.asValue(getSchemaFile),
      getSchemaFiles: awilix.asValue(getSchemaFiles),
      getStagedSchemaStatus: awilix.asValue(getStagedSchemaStatus),
      getAllSchemaFileContents: awilix.asValue(getAllSchemaFileContents),
      writeSchemaFiles: awilix.asValue(writeSchemaFiles),
    });
    logger = container.resolve("logger");
    fetch = container.resolve("fetch");
    confirm = container.resolve("confirm");
    fs = container.resolve("fs");
  });

  it("can pull schema", async function () {
    const gatherFSL = container.resolve("gatherFSL");
    gatherFSL.resolves(
      '[{"name":"coll.fsl","content":"collection MyColl {\\n  name: String\\n  index byName {\\n    terms [.name]\\n  }\\n}\\n"}]'
    );

    // user accepts the changes in the interactive prompt
    confirm.resolves(true);

    fetch.onCall(0).resolves(
      f({
        version: "194838274939473",
        files: [
          { filename: "main.fsl" },
          { filename: "second.fsl" },
          { filename: "third.fsl" },
        ],
      })
    );
    fetch.onCall(1).resolves(
      f({
        version: "194838274939473",
        status: "none",
      })
    );
    fetch.onCall(2).resolves(
      f({
        content:
          '[{"name":"main.fsl","content":"collection Main {\\n  name: String\\n  index byName {\\n    terms [.name]\\n  }\\n}\\n"}]',
      })
    );
    fetch.onCall(3).resolves(
      f({
        content:
          '[{"name":"second.fsl","content":"collection Second {\\n  name: String\\n  index byName {\\n    terms [.name]\\n  }\\n}\\n"}]',
      })
    );
    fetch.onCall(4).resolves(
      f({
        content:
          '[{"name":"third.fsl","content":"collection Third {\\n  name: String\\n  index byName {\\n    terms [.name]\\n  }\\n}\\n"}]',
      })
    );

    fs.writeFile.resolves();

    try {
      await run(`schema pull --secret "secret"`, container);
    } catch (e) {
      console.error(logger.stderr.args.join("\n"));
    }

    expect(gatherFSL).to.have.been.calledWith(".");

    const commonFetchParams = {
      method: "GET",
      headers: {
        AUTHORIZATION: "Bearer secret",
      },
    };

    expect(fetch).to.have.been.calledWith(
      "https://db.fauna.com/schema/1/files",
      commonFetchParams
    );
    // the version param in the URL is important - we use it for optimistic locking
    expect(fetch).to.have.been.calledWith(
      "https://db.fauna.com/schema/1/staged/status?version=194838274939473",
      commonFetchParams
    );
    expect(fetch).to.have.been.calledWith(
      "https://db.fauna.com/schema/1/files/main.fsl",
      commonFetchParams
    );
    expect(fetch).to.have.been.calledWith(
      "https://db.fauna.com/schema/1/files/second.fsl",
      commonFetchParams
    );
    expect(fetch).to.have.been.calledWith(
      "https://db.fauna.com/schema/1/files/third.fsl",
      commonFetchParams
    );

    expect(logger.stdout).to.have.been.calledWith("add:       main.fsl");
    expect(logger.stdout).to.have.been.calledWith("add:       second.fsl");
    expect(logger.stdout).to.have.been.calledWith("add:       third.fsl");
    expect(logger.stdout).to.have.been.calledWith(
      "Pull makes the following changes:"
    );
    // expect(writeSchemaFiles).to.have.been.calledWith([{
    // }])
    // expect(getAllSchemaFileContents).to.have.been.calledWith(['main.fsl'])
    // expect(deleteUnusedSchemaFiles.called).to.be.false

    expect(logger.stderr).to.not.have.been.called;
  });

  it("can be cancelled by the user without modifying the filesystem", async function () {
    const gatherFSL = container.resolve("gatherFSL");
    gatherFSL.resolves("");

    // user rejects the changes in the interactive prompt
    confirm.resolves(false);

    fetch.onCall(0).resolves(
      f({
        version: "194838274939473",
        files: [
          { filename: "main.fsl" },
          { filename: "second.fsl" },
          { filename: "third.fsl" },
        ],
      })
    );
    fetch.onCall(1).resolves(
      f({
        version: "194838274939473",
        status: "none",
      })
    );

    await run(`schema pull --secret "secret"`, container);

    expect(logger.stdout).to.have.been.calledWith("add:       main.fsl");
    expect(logger.stdout).to.have.been.calledWith("add:       second.fsl");
    expect(logger.stdout).to.have.been.calledWith("add:       third.fsl");
    expect(logger.stdout).to.have.been.calledWith(
      "Pull makes the following changes:"
    );
    expect(logger.stdout).to.have.been.calledWith("Change cancelled");
    expect(fs.writeFile).to.have.not.been.called;
    expect(fs.unlink).to.have.not.been.called;
    expect(fs.mkdirSync).to.have.not.been.called;
  });

  it.skip("can delete extraneous FSL files", async function () {});
  it.skip("can overwrite modified FSL files", async function () {});
  it.skip("does not modify the filesystem if it fails to read file contents", async function () {});

  it("requires the --staged flag if a schema change is staged", async function () {
    fetch.onCall(0).resolves(
      f({
        version: "194838274939473",
        files: [
          { filename: "main.fsl" },
          { filename: "second.fsl" },
          { filename: "third.fsl" },
        ],
      })
    );
    fetch.onCall(1).resolves(
      f({
        version: "194838274939473",
        status: "staged",
      })
    );

    const [error] = await tryToCatch(() =>
      run(`schema pull --secret "secret"`, container)
    );
    expect(error).to.have.property("code", 1);
    expect(container.resolve("gatherFSL")).to.not.have.been.called;
  });
});

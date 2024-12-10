//@ts-check

import * as awilix from "awilix";
import { expect } from "chai";
import sinon from "sinon";

import { run } from "../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../src/config/setup-test-container.mjs";
import {
  deleteUnusedSchemaFiles,
  getAllSchemaFileContents,
  writeSchemaFiles,
} from "../../src/lib/schema.mjs";
import { buildUrl, commonFetchParams, f } from "../helpers.mjs";

describe("schema pull", function () {
  let container, logger, confirm, fetch, fs, fsp, gatherFSL;

  beforeEach(() => {
    container = setupContainer();

    // this is a funny situation - we actually want the "real" implementations of these.
    // they end up calling fetch and fs, which is what we'll verify against in the tests.
    container.register({
      getAllSchemaFileContents: awilix.asValue(
        sinon.spy(getAllSchemaFileContents),
      ),
      writeSchemaFiles: awilix.asValue(sinon.spy(writeSchemaFiles)),
      deleteUnusedSchemaFiles: awilix.asValue(
        sinon.spy(deleteUnusedSchemaFiles),
      ),
    });
    logger = container.resolve("logger");
    fetch = container.resolve("fetch");
    confirm = container.resolve("confirm");
    fs = container.resolve("fs");
    fsp = container.resolve("fsp");
    gatherFSL = container.resolve("gatherFSL");
  });

  it("can pull schema, adding new files and overwriting existing files", async function () {
    gatherFSL.resolves([
      {
        name: "coll.fsl",
        content:
          "collection MyColl {\\n  name: String\\n  index byName {\\n    terms [.name]\\n  }\\n}\\n",
      },
      {
        name: "main.fsl",
        content:
          "collection OldMain {\\n  name: String\\n  index byName {\\n    terms [.name]\\n  }\\n}\\n",
      },
    ]);

    // user accepts the changes in the interactive prompt
    confirm.resolves(true);

    fetch.onCall(0).resolves(
      f({
        version: "194838274939473",
        // assume no staged schema for this test
        status: "none",
      }),
    );
    fetch.onCall(1).resolves(
      f({
        version: "194838274939473",
        files: [
          { filename: "main.fsl" },
          { filename: "second.fsl" },
          { filename: "third.fsl" },
        ],
      }),
    );
    fetch.onCall(2).resolves(
      f({
        content:
          "collection Main {\\n  name: String\\n  index byName {\\n    terms [.name]\\n  }\\n}\\n",
      }),
    );
    fetch.onCall(3).resolves(
      f({
        content:
          "collection Second {\\n  name: String\\n  index byName {\\n    terms [.name]\\n  }\\n}\\n",
      }),
    );
    fetch.onCall(4).resolves(
      f({
        content:
          "collection Third {\\n  name: String\\n  index byName {\\n    terms [.name]\\n  }\\n}\\n",
      }),
    );

    fs.writeFile.resolves();

    await run(`schema pull --secret "secret"`, container);

    expect(gatherFSL).to.have.been.calledWith(".");

    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/staged/status"),
      commonFetchParams,
    );
    // the version param in the URL is important - we use it for optimistic locking
    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/files", {
        version: "194838274939473",
        staged: "false",
      }),
      commonFetchParams,
    );
    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/files/main.fsl", {
        version: "194838274939473",
        staged: "false",
      }),
      commonFetchParams,
    );
    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/files/second.fsl", {
        version: "194838274939473",
        staged: "false",
      }),
      commonFetchParams,
    );
    expect(fetch).to.have.been.calledWith(
      buildUrl("/schema/1/files/third.fsl", {
        version: "194838274939473",
        staged: "false",
      }),
      commonFetchParams,
    );

    expect(logger.stdout).to.have.been.calledWith("overwrite: main.fsl");
    expect(logger.stdout).to.have.been.calledWith("add:       second.fsl");
    expect(logger.stdout).to.have.been.calledWith("add:       third.fsl");
    expect(logger.stdout).to.have.been.calledWith(
      "Pulling active schema will make the following changes:",
    );

    expect(fs.mkdirSync).to.have.been.calledWith(".", { recursive: true });
    expect(fsp.writeFile).to.have.been.calledWith(
      "main.fsl",
      "collection Main {\\n  name: String\\n  index byName {\\n    terms [.name]\\n  }\\n}\\n",
    );
    expect(fsp.writeFile).to.have.been.calledWith(
      "second.fsl",
      "collection Second {\\n  name: String\\n  index byName {\\n    terms [.name]\\n  }\\n}\\n",
    );
    expect(fsp.writeFile).to.have.been.calledWith(
      "third.fsl",
      "collection Third {\\n  name: String\\n  index byName {\\n    terms [.name]\\n  }\\n}\\n",
    );
    expect(container.resolve("deleteUnusedSchemaFiles")).to.not.have.been
      .called;

    expect(logger.stderr).to.not.have.been.called;
  });

  it("can be cancelled by the user without modifying the filesystem", async function () {
    gatherFSL.resolves([
      {
        name: "coll.fsl",
        content:
          "collection MyColl {\\n  name: String\\n  index byName {\\n    terms [.name]\\n  }\\n}\\n",
      },
      {
        name: "main.fsl",
        content:
          "collection OldMain {\\n  name: String\\n  index byName {\\n    terms [.name]\\n  }\\n}\\n",
      },
    ]);

    // user rejects the changes in the interactive prompt
    confirm.resolves(false);

    fetch.onCall(0).resolves(
      f({
        version: "194838274939473",
        // assume no staged schema for this test
        status: "none",
      }),
    );
    fetch.onCall(1).resolves(
      f({
        version: "194838274939473",
        files: [
          { filename: "main.fsl" },
          { filename: "second.fsl" },
          { filename: "third.fsl" },
        ],
      }),
    );

    await run(`schema pull --secret "secret" --delete`, container);

    expect(logger.stdout).to.have.been.calledWith("overwrite: main.fsl");
    expect(logger.stdout).to.have.been.calledWith("add:       second.fsl");
    expect(logger.stdout).to.have.been.calledWith("add:       third.fsl");
    expect(logger.stdout).to.have.been.calledWith("delete:    coll.fsl");
    expect(logger.stdout).to.have.been.calledWith(
      "Pulling active schema will make the following changes:",
    );
    expect(logger.stdout).to.have.been.calledWith("Change cancelled.");
    expect(fs.writeFile).to.have.not.been.called;
    expect(fsp.unlink).to.have.not.been.called;
    // Called twice during Credentials initialization, but not called during the pull command
    expect(fs.mkdirSync).to.have.been.calledTwice;
  });

  it("can delete extraneous FSL files", async function () {
    gatherFSL.resolves([
      {
        name: "coll.fsl",
        content:
          "collection MyColl {\\n  name: String\\n  index byName {\\n    terms [.name]\\n  }\\n}\\n",
      },
      {
        name: "main.fsl",
        content:
          "collection OldMain {\\n  name: String\\n  index byName {\\n    terms [.name]\\n  }\\n}\\n",
      },
    ]);

    fetch.onCall(0).resolves(
      f({
        version: "194838274939473",
        // assume no staged schema for this test
        status: "none",
      }),
    );
    fetch.onCall(1).resolves(
      f({
        version: "194838274939473",
        files: [{ filename: "main.fsl" }],
      }),
    );
    fetch.onCall(2).resolves(
      f({
        content:
          "collection Main {\\n  name: String\\n  index byName {\\n    terms [.name]\\n  }\\n}\\n",
      }),
    );

    // user accepts the changes in the interactive prompt
    confirm.resolves(true);

    await run(`schema pull --secret "secret" --delete`, container);

    expect(fsp.unlink).to.have.been.calledOnce;
    expect(fsp.unlink).to.have.been.calledWith("coll.fsl");
    expect(logger.stdout).to.have.been.calledWith("overwrite: main.fsl");
    expect(logger.stdout).to.have.been.calledWith("delete:    coll.fsl");
    expect(logger.stdout).to.have.been.calledWith(
      "Pulling active schema will make the following changes:",
    );

    expect(fs.mkdirSync).to.have.been.calledWith(".", { recursive: true });
    expect(fsp.writeFile).to.have.been.calledWith(
      "main.fsl",
      "collection Main {\\n  name: String\\n  index byName {\\n    terms [.name]\\n  }\\n}\\n",
    );

    expect(logger.stderr).to.not.have.been.called;
  });

  it.skip("does not modify the filesystem if it fails to read file contents", async function () {});

  [
    { argvActive: true, remoteStaged: true, expectedStagedParam: "false" },
    { argvActive: false, remoteStaged: false, expectedStagedParam: "false" },
    { argvActive: false, remoteStaged: true, expectedStagedParam: "true" },
  ].forEach(({ argvActive, remoteStaged, expectedStagedParam }) => {
    it(`can pull ${expectedStagedParam === "true" ? "staged" : "active"} schema while schema is ${remoteStaged ? "staged" : "not staged"}, and --active is ${argvActive ? "specified" : "not specified"}`, async function () {
      fetch.onCall(0).resolves(
        f({
          version: "194838274939473",
          status: remoteStaged ? "ready" : "none",
        }),
      );
      fetch.onCall(1).resolves(
        f({
          version: "194838274939473",
          files: [{ filename: "main.fsl" }],
        }),
      );
      fetch.onCall(2).resolves(
        f({
          content:
            "collection Main {\\n  name: String\\n  index byName {\\n    terms [.name]\\n  }\\n}\\n",
        }),
      );

      // user accepts the changes in the interactive prompt
      confirm.resolves(true);

      await run(
        `schema pull --secret "secret" ${argvActive ? "--active" : ""}`,
        container,
      );

      expect(fetch).to.have.been.calledWith(
        buildUrl("/schema/1/staged/status"),
        commonFetchParams,
      );
      // the version param in the URL is important - we use it for optimistic locking
      expect(fetch).to.have.been.calledWith(
        buildUrl("/schema/1/files", {
          version: "194838274939473",
          staged: expectedStagedParam,
        }),
        commonFetchParams,
      );
      expect(fetch).to.have.been.calledWith(
        buildUrl("/schema/1/files/main.fsl", {
          version: "194838274939473",
          staged: expectedStagedParam,
        }),
        commonFetchParams,
      );

      expect(logger.stderr).to.not.have.been.called;
    });
  });
});

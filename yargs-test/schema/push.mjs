import * as awilix from "awilix/lib/awilix.module.mjs";
import { expect } from "chai";
import { run } from "../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../src/config/setup-test-container.mjs";
import { makeFaunaRequest } from "../../src/lib/db.mjs";

describe("schema push", function () {
  let container;

  beforeEach(() => {
    container = setupContainer();
    container.register({
      makeFaunaRequest: awilix.asValue(makeFaunaRequest),
    });
  });

  it("can force push schema", async function () {
    const fetch = container.resolve("fetch");

    const gatherFSL = container.resolve("gatherFSL");
    gatherFSL.resolves(
      '[{"name":"coll.fsl","content":"collection MyColl {\\n  name: String\\n  index byName {\\n    terms [.name]\\n  }\\n}\\n"}]'
    );

    const logger = container.resolve("logger");

    await run(`schema push --secret "secret" --force`, container);

    expect(gatherFSL).to.have.been.calledWith(".");

    expect(fetch).to.have.been.calledWith(
      "https://db.fauna.com/schema/1/update?force=true&staged=false",
      {
        method: "POST",
        headers: { AUTHORIZATION: "Bearer secret" },
        body: '[{"name":"coll.fsl","content":"collection MyColl {\\n  name: String\\n  index byName {\\n    terms [.name]\\n  }\\n}\\n"}]',
      }
    );

    expect(logger.stdout).to.not.be.called;
    expect(logger.stderr).to.not.be.called;
  });

  it.skip("can push schema by version", async function () {});

  it.skip("can staged schema changes", async function () {});

  it.skip("can be cancelled by the user before making mutating network calls", async function () {});

  it("can push schema from another directory", async function () {
    const gatherFSL = container.resolve("gatherFSL");

    await run(
      `schema push --secret "secret" --force --dir "/absolute/path/elsewhere"`,
      container
    );

    expect(gatherFSL).to.have.been.calledWith("/absolute/path/elsewhere");
  });

  it.skip("warns when attempting to push an empty diff", async function () {});
});

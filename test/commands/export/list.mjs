// @ts-check

import { expect } from "chai";

import { run } from "../../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../../src/config/setup-test-container.mjs";
import { colorize, Format } from "../../../src/lib/formatting/colorize.mjs";

const listExportStub = (opts) => ({
  id: "test-export-id",
  state: "Pending",
  database: "us-std/example",
  created_at: "2025-01-02T22:59:51",
  updated_at: "2025-01-02T22:59:51",
  ...opts,
});

describe("export list", () => {
  let container, stdout, listExports;

  beforeEach(() => {
    container = setupContainer();
    stdout = container.resolve("stdoutStream");
    ({ listExports } = container.resolve("accountAPI"));
  });

  it("lists exports", async () => {
    const stubbedResponse = listExportStub({
      id: "tid",
      database: "us-std/test",
    });
    listExports.resolves({ results: [stubbedResponse] });

    await run(`export list`, container);
    await stdout.waitForWritten();

    expect(stdout.getWritten()).to.equal(
      `${[
        "database,id,created_at,updated_at,state",
        "us-std/test,tid,2025-01-02T22:59:51,2025-01-02T22:59:51,Pending",
      ].join("\n")}\n`,
    );
    expect(listExports).to.have.been.calledWith({
      maxResults: 100,
      state: [],
    });
  });

  it("supports --json", async () => {
    const stubbedResponse = listExportStub();
    listExports.resolves({ results: [stubbedResponse] });

    await run(`export list --json`, container);
    await stdout.waitForWritten();

    expect(stdout.getWritten()).to.equal(
      `${colorize([stubbedResponse], { format: Format.JSON })}\n`,
    );
  });

  it("supports --max-results", async () => {
    listExports.resolves({ results: [listExportStub()] });

    await run(`export list --max-results 1`, container);

    expect(listExports).to.have.been.calledWith({
      maxResults: 1,
      state: [],
    });
  });

  it("supports --state", async () => {
    listExports.resolves({ results: [listExportStub()] });

    await run(`export list --state Pending --state InProgress`, container);

    expect(listExports).to.have.been.calledWith({
      maxResults: 100,
      state: ["Pending", "InProgress"],
    });
  });
});

// @ts-check

import { expect } from "chai";

import { run } from "../../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../../src/config/setup-test-container.mjs";
import { colorize, Format } from "../../../src/lib/formatting/colorize.mjs";

const listExportStub = (opts) => ({
  id: "419630463817089613",
  state: "Pending",
  database: "us-std/demo",
  format: "simple",
  destination: {
    s3: {
      bucket: "test-bucket",
      path: "some/key/prefix",
    },
  },
  created_at: "2025-01-09T19:07:25.642703Z",
  updated_at: "2025-01-09T19:07:25.642703Z",
  destination_uri: "",
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
      id: "419630463817089613",
      database: "us-std/test",
    });
    listExports.resolves({ results: [stubbedResponse] });

    await run(`export list`, container);
    await stdout.waitForWritten();

    expect(stdout.getWritten()).to.equal(
      `${[
        "id\tdatabase\tcollections\tdestination_uri\tstate",
        "419630463817089613\tus-std/test\t\t\tPending",
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
      `${colorize([{ ...stubbedResponse }], { format: Format.JSON })}\n`,
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

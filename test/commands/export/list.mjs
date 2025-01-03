// @ts-check

import { expect } from "chai";
import sinon from "sinon";

import { run } from "../../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../../src/config/setup-test-container.mjs";
import { colorize, Format } from "../../../src/lib/formatting/colorize.mjs";
import { mockAccessKeysFile } from "../../helpers.mjs";

const listExportStub = (opts) => ({
  id: "test-export-id",
  state: "Pending",
  database: "us-std/example",
  created_at: "2025-01-02T22:59:51",
  updated_at: "2025-01-02T22:59:51",
  ...opts,
});

describe("database export list", () => {
  let container, stdout, stderr, makeAccountRequest;

  beforeEach(() => {
    container = setupContainer();
    stdout = container.resolve("stdoutStream");
    stderr = container.resolve("stderrStream");
    makeAccountRequest = container.resolve("makeAccountRequest");

    mockAccessKeysFile({ fs: container.resolve("fs") });
  });

  it("lists exports", async () => {
    const stubbedResponse = listExportStub({
      id: "tid",
      database: "us-std/test",
    });
    makeAccountRequest.resolves({ results: [stubbedResponse] });

    await run(`export list`, container);
    await stdout.waitForWritten();

    expect(stdout.getWritten()).to.equal(
      `${[
        "id,database,created_at,updated_at,state",
        "tid,us-std/test,2025-01-02T22:59:51,2025-01-02T22:59:51,Pending",
      ].join("\n")}\n`,
    );
    expect(makeAccountRequest).to.have.been.calledWith({
      method: "GET",
      prefix: "/v2",
      path: "/exports",
      params: {
        max_results: 16,
      },
      secret: sinon.match.string,
    });
  });

  it("supports --json", async () => {
    const stubbedResponse = listExportStub();
    makeAccountRequest.resolves({ results: [stubbedResponse] });

    await run(`export list --json`, container);
    await stdout.waitForWritten();

    expect(stdout.getWritten()).to.equal(
      `${colorize([stubbedResponse], { format: Format.JSON })}\n`,
    );
  });

  it("supports --max-results", async () => {
    makeAccountRequest.resolves({ results: [listExportStub()] });

    await run(`export list --max-results 1`, container);

    expect(makeAccountRequest).to.have.been.calledWith({
      method: "GET",
      prefix: "/v2",
      path: "/exports",
      params: {
        max_results: 1,
      },
      secret: sinon.match.string,
    });
  });

  it("should output an error if --secret is used", async () => {
    try {
      await run("export list --secret=some-test-secret", container);
    } catch {}

    await stderr.waitForWritten();
    expect(stderr.getWritten()).to.contain(
      "Exports are not supported with --secret. Use --database instead.",
    );
  });

  it("should output an error if --local is used", async () => {
    try {
      await run("export list --local", container);
    } catch {}

    await stderr.waitForWritten();
    expect(stderr.getWritten()).to.contain(
      "Exports do not support --local and the Fauna docker container.",
    );
  });
});

// @ts-check

import { expect } from "chai";
import sinon from "sinon";

import { run } from "../../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../../src/config/setup-test-container.mjs";
import { colorize, Format } from "../../../src/lib/formatting/colorize.mjs";

const createExportStub = (opts) => ({
  id: "test-export-id",
  state: "Pending",
  database: "us-std/example",
  format: "simple",
  destination: {
    s3: {
      path: "/test/key",
      bucket: "test-bucket",
    },
  },
  created_at: "2025-01-02T22:59:51",
  updated_at: "2025-01-02T22:59:51",
  destination_uri: "",
  ...opts,
});

describe("export create s3", () => {
  let container, stderr, stdout, createExport;

  beforeEach(() => {
    container = setupContainer();
    stderr = container.resolve("stderrStream");
    stdout = container.resolve("stdoutStream");
    ({ createExport } = container.resolve("accountAPI"));
  });

  it("creates an export", async () => {
    const database = "us-std/example";
    const bucket = "test-bucket";
    const path = "/test/key";
    const stubbedResponse = createExportStub({
      database,
      destination: {
        s3: {
          path,
          bucket,
        },
      },
      format: "simple",
    });
    createExport.resolves(stubbedResponse);

    await run(
      `export create s3 --database '${database}' --bucket '${bucket}' --path '${path}'`,
      container,
    );
    await stdout.waitForWritten();

    expect(stdout.getWritten()).to.equal(`id: test-export-id
state: Pending
database: us-std/example
format: simple
destination:
  s3:
    path: /test/key
    bucket: test-bucket
created_at: 2025-01-02T22:59:51
updated_at: 2025-01-02T22:59:51
destination_uri: ""
`);
    expect(createExport).to.have.been.calledWith({
      database,
      collections: [],
      destination: {
        s3: {
          bucket,
          path,
        },
      },
      format: "simple",
    });
  });

  it("outputs the full response with --json", async () => {
    const database = "us-std/example";
    const bucket = "test-bucket";
    const path = "/test/key";
    const stubbedResponse = createExportStub({
      database,
      destination: {
        s3: {
          path,
          bucket,
        },
      },
      format: "simple",
    });
    createExport.resolves(stubbedResponse);

    await run(
      `export create s3 --database '${database}' --bucket '${bucket}' --path '${path}' --json`,
      container,
    );
    await stdout.waitForWritten();

    expect(stdout.getWritten()).to.equal(
      `${colorize(stubbedResponse, { format: Format.JSON })}\n`,
    );
  });

  it("passes the format to the account api", async () => {
    createExport.resolves(createExportStub({ format: "tagged" }));
    await run(
      `export create s3 --database 'us-std/example' --bucket 'test-bucket' --path 'test/key' --format 'tagged'`,
      container,
    );
    expect(createExport).to.have.been.calledWith(
      sinon.match({
        format: "tagged",
      }),
    );
  });

  it("should allow providing multiple collections", async () => {
    createExport.resolves(createExportStub({ collections: ["foo", "bar"] }));
    await run(
      `export create s3 --database 'us-std/example' --bucket 'test-bucket' --path 'test/key' --collection foo --collection bar`,
      container,
    );
    expect(createExport).to.have.been.calledWith(
      sinon.match({
        database: "us-std/example",
        collections: ["foo", "bar"],
      }),
    );
  });

  it("should output an error if --database is not provided", async () => {
    try {
      await run(
        "export create s3 --bucket test-bucket --path test/key",
        container,
      );
    } catch {}

    await stderr.waitForWritten();
    expect(stderr.getWritten()).to.contain(
      "--database is required to create an export.",
    );
  });
});

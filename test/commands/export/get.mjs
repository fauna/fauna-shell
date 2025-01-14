import { expect } from "chai";

import { run } from "../../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../../src/config/setup-test-container.mjs";

const getExportStub = (opts) => ({
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

describe("export get", () => {
  let container, getExport, stdout;

  beforeEach(() => {
    container = setupContainer();
    getExport = container.resolve("accountAPI").getExport;
    stdout = container.resolve("stdoutStream");
  });

  it("should get an export by ID", async () => {
    const stubbedResponse = getExportStub({
      failure: {
        code: "validation_error",
        message: "failed to get bucket region: bucket not found",
      },
      failed_at: "2025-01-09T19:07:26.600811Z",
      state: "Failed",
    });
    getExport.resolves(stubbedResponse);

    await run(`export get 419630463817089613`, container);
    await stdout.waitForWritten();

    expect(stdout.getWritten()).to.equal(`id: "419630463817089613"
state: Failed
database: us-std/demo
format: simple
destination:
  s3:
    bucket: test-bucket
    path: some/key/prefix
created_at: 2025-01-09T19:07:25.642703Z
updated_at: 2025-01-09T19:07:25.642703Z
destination_uri: ""
failure:
  code: validation_error
  message: "failed to get bucket region: bucket not found"
failed_at: 2025-01-09T19:07:26.600811Z
`);
    expect(getExport).to.have.been.calledWith({
      exportId: "419630463817089613",
    });
  });

  it("should output JSON when --json is passed", async () => {
    const stubbedResponse = getExportStub();
    getExport.resolves(stubbedResponse);

    await run(`export get 419630463817089613 --json`, container);
    await stdout.waitForWritten();

    expect(stdout.getWritten()).to.equal(
      `${JSON.stringify(stubbedResponse, null, 2)}\n`,
    );
  });
});

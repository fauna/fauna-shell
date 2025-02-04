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

  const scenarios = [
    {
      description: "using --destination",
      args: "--destination 's3://test-bucket/test/key'",
      expectedDestination: {
        s3: {
          bucket: "test-bucket",
          path: "/test/key",
        },
        uri: "s3://test-bucket/test/key",
      },
      expectedDestArgs: "s3://test-bucket/test/key",
    },
    {
      description: "using --bucket and --path",
      args: "--bucket 'test-bucket' --path '/test/key'",
      expectedDestination: {
        s3: {
          bucket: "test-bucket",
          path: "/test/key",
        },
        uri: "s3://test-bucket/test/key",
      },
      expectedDestArgs: { s3: { bucket: "test-bucket", path: "/test/key" } },
    },
  ];

  scenarios.forEach(
    ({ description, args, expectedDestination, expectedDestArgs }) => {
      it(`creates an export ${description}`, async () => {
        const database = "us-std/example";
        const stubbedResponse = createExportStub({
          database,
          destination: expectedDestination,
          format: "simple",
          idempotent_replayed: false,
        });
        createExport.resolves(stubbedResponse);

        await run(
          `export create s3 --database '${database}' ${args}`,
          container,
        );
        await stdout.waitForWritten();

        expect(stdout.getWritten()).to.equal(`id: test-export-id
state: Pending
database: us-std/example
format: simple
destination:
  s3:
    bucket: test-bucket
    path: /test/key
  uri: s3://test-bucket/test/key
created_at: 2025-01-02T22:59:51
updated_at: 2025-01-02T22:59:51
idempotent_replayed: false
`);
        expect(createExport).to.have.been.calledWith({
          database,
          collections: [],
          destination: expectedDestArgs,
          format: "simple",
          idempotency: undefined,
        });
      });

      it(`handles idempotent replay with idempotent_replayed: true ${description}`, async () => {
        const database = "us-std/example";
        const stubbedResponse = createExportStub({
          database,
          destination: expectedDestination,
          format: "simple",
          idempotent_replayed: true,
        });
        createExport.resolves(stubbedResponse);

        await run(
          `export create s3 --database '${database}' ${args} --idempotency XYZ`,
          container,
        );
        await stdout.waitForWritten();

        expect(stdout.getWritten()).to.equal(`id: test-export-id
state: Pending
database: us-std/example
format: simple
destination:
  s3:
    bucket: test-bucket
    path: /test/key
  uri: s3://test-bucket/test/key
created_at: 2025-01-02T22:59:51
updated_at: 2025-01-02T22:59:51
idempotent_replayed: true
`);
      });

      it(`outputs the full response with --json ${description}`, async () => {
        const database = "us-std/example";
        const stubbedResponse = createExportStub({
          database,
          destination: expectedDestination,
          format: "simple",
        });
        createExport.resolves(stubbedResponse);

        await run(
          `export create s3 --database '${database}' ${args} --json`,
          container,
        );
        await stdout.waitForWritten();

        expect(stdout.getWritten()).to.equal(
          `${colorize(stubbedResponse, { format: Format.JSON })}\n`,
        );
      });

      it(`passes the format to the account api ${description}`, async () => {
        createExport.resolves(createExportStub({ format: "tagged" }));
        await run(
          `export create s3 --database 'us-std/example' ${args} --format 'tagged'`,
          container,
        );
        expect(createExport).to.have.been.calledWith(
          sinon.match({
            format: "tagged",
          }),
        );
      });

      it(`should allow providing multiple collections ${description}`, async () => {
        createExport.resolves(
          createExportStub({ collections: ["foo", "bar"] }),
        );
        await run(
          `export create s3 --database 'us-std/example' ${args} --collection foo --collection bar`,
          container,
        );
        expect(createExport).to.have.been.calledWith(
          sinon.match({
            database: "us-std/example",
            collections: ["foo", "bar"],
          }),
        );
      });
    },
  );

  const invalidScenarios = [
    {
      description: "an invalid S3 URI is given as the --destination input",
      args: "--destination invalid-uri",
      expectedError: "Invalid S3 URI format. Expected format: s3://bucket/path",
    },
    {
      description: "both --destination and --bucket are given",
      args: "--destination s3://test-bucket/test/key --bucket test-bucket",
      expectedError:
        "Cannot specify --destination with --bucket or --path. Use either --destination or both --bucket and --path.",
    },
    {
      description: "both --destination and --path are given",
      args: "--destination s3://test-bucket/test/key --path /test/key",
      expectedError:
        "Cannot specify --destination with --bucket or --path. Use either --destination or both --bucket and --path.",
    },
    {
      description: "an empty string is given as the --idempotency input",
      args: "--destination s3://test-bucket/test/key --idempotency ",
      expectedError: "--idempotency can't be an empty string.",
    },
    {
      description: "an blank string is given as the --idempotency input",
      args: "--destination s3://test-bucket/test/key --idempotency '  '",
      expectedError: "--idempotency can't be an empty string.",
    },
  ];

  invalidScenarios.forEach(({ description, args, expectedError }) => {
    it(`should display an error when ${description}`, async () => {
      try {
        await run(
          `export create s3 --database us-std/example ${args}`,
          container,
        );
      } catch {}

      await stderr.waitForWritten();
      expect(stderr.getWritten()).to.contain(expectedError);
    });
  });

  it("should output an error if --database is not provided", async () => {
    const destination = "s3://test-bucket/test/key";
    try {
      await run(`export create s3 --destination ${destination}`, container);
    } catch {}

    await stderr.waitForWritten();
    expect(stderr.getWritten()).to.contain(
      "--database is required to create an export.",
    );
  });
});

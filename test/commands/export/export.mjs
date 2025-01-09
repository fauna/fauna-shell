// @ts-check

import { expect } from "chai";

import { run } from "../../../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../../../src/config/setup-test-container.mjs";

describe("export", () => {
  let container, stderr;

  beforeEach(() => {
    container = setupContainer();
    stderr = container.resolve("stderrStream");
  });

  [
    "export create s3 -d us/demo --bucket test-bucket --path test/key --local",
    "export list --local",
    "export get 1234567890 --local",
  ].forEach((cmd) => {
    it(`should output an error if --local is used: ${cmd}`, async () => {
      try {
        await run(cmd, container);
      } catch {}

      await stderr.waitForWritten();
      expect(stderr.getWritten()).to.contain(
        "Exports do not support --local and the Fauna docker container.",
      );
    });
  });

  [
    "export create s3 --bucket test-bucket --path test/key --secret=some-test-secret",
    "export list --secret=some-test-secret",
    "export get 1234567890 --secret=some-test-secret",
  ].forEach((cmd) => {
    it(`should output an error if --secret is provided: ${cmd}`, async () => {
      try {
        await run(cmd, container);
      } catch {}

      await stderr.waitForWritten();
      expect(stderr.getWritten()).to.contain(
        "Exports are not supported with --secret.",
      );
    });
  });
});

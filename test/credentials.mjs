import assert from "assert";
import * as awilix from "awilix";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

import { run } from "../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../src/config/setup-test-container.mjs";
import { buildCredentials } from "../src/lib/auth/credentials.mjs";

const __dirname = import.meta.dirname;
const yamlConfig = `
default:
  # comment!
  secret: "very-secret"
  url: "https://db.fauna.com:443"
`.trim();

// Test the credentials singleton and its class variables with buildCredentials after passing in custom argv
describe("credentials", function () {
  let container, stderr, stdout, fs;

  beforeEach(() => {
    container = setupContainer();
    // container.register({
    //   performV10Query: awilix.asValue(performV10Query),
    //   performQuery: awilix.asValue(performQuery),
    // });

    stderr = container.resolve("stderrStream");
    stdout = container.resolve("stdoutStream");
    fs = container.resolve("fs");

    delete process.env.FAUNA_CONFIG;
    delete process.env.FAUNA_SECRET;
  });

  describe("account keys", () => {
    it("should use account key from config file", async () => {
      const testKey = "fnATestAccountKey123";
      const tempConfigPath = path.join(os.tmpdir(), "fauna-test-config.json");

      await run("db list --config ./prod.yaml", container);

      // Create temporary config file
      const configContent = {
        account_key: testKey,
      };
      fs.readFileSync
        .withArgs(path.join(__dirname, "../prod.yaml"))
        .returns(configContent);

      const creds = container.resolve("credentials");
      // const creds = await buildCredentials({
      //   config: tempConfigPath,
      // });

      assert.equal(creds.accountKeys.key, testKey);
    });

    // Test 2: Correct account key is used when multiple keys are present
    // Test 3: Error when account key is not present
    // Test 4: Error when account key is invalid
    // Test 5: Error when account key is not a string
    // Test 6: Error when account key is not a valid account key
  });

  describe("database keys", () => {
    // Test 1: Correct database key is used from various source of: command flag, env var, config file or local credentials file
    // Test 2: Correct database key is used when multiple keys are present
    // Test 3: Error when database key is not present
  });
});

import * as nodeFs from "node:fs";

import * as awilix from "awilix";
import { expect } from "chai";
import path from "path";
import sinon from "sinon";

import { run } from "../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../src/config/setup-test-container.mjs";
import originalAccountAPI from "../src/lib/account-api.mjs";
import { AuthenticationError } from "../src/lib/errors.mjs";
import { runQueryFromString as originalRunQueryFromString } from "../src/lib/fauna-client.mjs";
import { f } from "./helpers.mjs";

const defaultAccountKeysFile = {
  default: {
    accountKey: "some-account-key",
    refreshToken: "some-refresh-token",
  },
};
const defaultDatabaseKeysFile = {
  "some-account-key": {
    "us-std:admin": {
      secret: "some-database-secret",
    },
  },
};

// Ensure the credentials middleware correctly sets and refreshes account and database keys
describe("credentials", function () {
  let container, stderr, fs, credsDir, accountAPI, fetch;

  // Instead of mocking `fs` to return certain values in each test, let the middleware
  //   read files in the actual filesystem.
  const setCredsFiles = (accessKeys, secretKeys) => {
    fs.mkdirSync(credsDir, { recursive: true });
    fs.writeFileSync(
      `${credsDir}/access_keys`,
      JSON.stringify(accessKeys, null, 2),
    );
    fs.writeFileSync(
      `${credsDir}/secret_keys`,
      JSON.stringify(secretKeys, null, 2),
    );
  };

  beforeEach(() => {
    container = setupContainer();
    stderr = container.resolve("stderrStream");
    container.register({
      fs: awilix.asValue(nodeFs),
    });
    fs = container.resolve("fs");
    accountAPI = container.resolve("accountAPI");
    fetch = container.resolve("fetch");

    const homedir = container.resolve("homedir")();
    credsDir = path.join(homedir, ".fauna/credentials");
    setCredsFiles(defaultAccountKeysFile, defaultDatabaseKeysFile);

    delete process.env.FAUNA_ACCOUNT_KEY;
    delete process.env.FAUNA_SECRET;
  });

  // Given a command and a preset state for the credentials files, ensure
  //  the middleware correctly sets the account and database keys before any network
  //  calls are made.
  describe("credentials middleware class setup", () => {
    const defaultLocalCreds = {
      accountKeys: defaultAccountKeysFile,
      databaseKeys: defaultDatabaseKeysFile,
    };
    [
      {
        command: `query "Database.all()" -d us-std --no-color --json`,
        localCreds: defaultLocalCreds,
        expected: {
          accountKeys: {
            key: "some-account-key",
            keySource: "credentials-file",
          },
          databaseKeys: {
            role: "admin",
            key: "some-database-secret",
            keySource: "credentials-file",
          },
        },
      },
      {
        command: `query "Database.all()" --secret user-secret --no-color --json`,
        localCreds: defaultLocalCreds,
        expected: {
          accountKeys: {
            key: "some-account-key",
            keySource: "credentials-file",
          },
          databaseKeys: {
            role: undefined,
            key: "user-secret",
            keySource: "user",
          },
        },
      },
      {
        command: `query "Database.all()" -d us-std --accountKey user-account-key --no-color --json`,
        localCreds: defaultLocalCreds,
        expected: {
          accountKeys: {
            key: "user-account-key",
            keySource: "user",
          },
          databaseKeys: {
            role: "admin",
            key: undefined,
            keySource: "credentials-file",
          },
        },
      },
      {
        command: `query "Database.all()" -d us-std -r myrole --no-color --json`,
        localCreds: defaultLocalCreds,
        expected: {
          accountKeys: {
            key: "some-account-key",
            keySource: "credentials-file",
          },
          databaseKeys: {
            role: "myrole",
            key: undefined,
            keySource: "credentials-file",
          },
        },
      },
      {
        command: `query "Database.all()" -d us-std/test:badpath --no-color --json`,
        localCreds: defaultLocalCreds,
        expected: {
          databaseKeys: {
            role: "admin",
            path: "us-std/test:badpath",
            key: undefined,
            keySource: "credentials-file",
          },
        },
      },
    ].forEach(({ command, expected, localCreds }) => {
      it(`builds credentials from: '${command}'`, async () => {
        setCredsFiles(localCreds.accountKeys, localCreds.databaseKeys);
        await run(command, container);
        const credentials = container.resolve("credentials");
        if (expected.accountKeys) {
          expect(credentials.accountKeys).to.deep.include(expected.accountKeys);
        }
        if (expected.databaseKeys) {
          expect(credentials.databaseKeys).to.deep.include(
            expected.databaseKeys,
          );
        }
      });
    });
  });

  // Test various network-dependent functionality of the credentials middleware around account keys
  describe("account keys", () => {
    it("prompts login when account key and refresh token are empty", async () => {
      try {
        setCredsFiles({}, {});
        await run(
          `query "Database.all()" -d us-std --no-color --json`,
          container,
        );
      } catch (e) {
        expect(stderr.getWritten()).to.contain(
          "The requested user 'default' is not signed in or has expired.",
        );
      }
    });

    it("prompts login when refresh token is invalid", async () => {
      setCredsFiles(defaultAccountKeysFile, {});
      accountAPI.refreshSession.rejects(new AuthenticationError());

      try {
        await run(
          `query "Database.all()" -d us-std --no-color --json`,
          container,
        );
      } catch (e) {
        expect(stderr.getWritten()).to.contain(
          "The requested user 'default' is not signed in or has expired",
        );
      }
    });

    it("refreshes account key", async () => {
      setCredsFiles(defaultAccountKeysFile, {});
      // We want to test the refresh logic, so we need to can't mock the createKey function
      const refreshSession = sinon.stub();
      container.register({
        accountAPI: awilix.asValue({
          createKey: originalAccountAPI.createKey,
          refreshSession,
        }),
      });

      fetch.onCall(0).resolves(f({}, 401));

      refreshSession.resolves({
        accountKey: "new-account-key",
        refreshToken: "new-refresh-token",
      });

      fetch.onCall(1).resolves(f({ secret: "new-secret" }));

      await run(
        `query "Database.all()" -d us-std --no-color --json`,
        container,
      );

      const credentials = container.resolve("credentials");
      expect(credentials.accountKeys).to.deep.include({
        key: "new-account-key",
        keySource: "credentials-file",
      });
    });

    it("shows error when user provided account key is invalid", async () => {
      process.env.FAUNA_ACCOUNT_KEY = "invalid-account-key";
      fetch
        .withArgs(
          sinon.match(/\/databases\/keys/),
          sinon.match({ method: "POST" }),
        )
        .onCall(0)
        .resolves(f({}, 401));
      try {
        await run(
          `query "Database.all()" -d us-std --no-color --json`,
          container,
        );
      } catch (e) {
        expect(stderr.getWritten()).to.contain(
          "Account key provided by 'user' is invalid. Please provide an updated account key.",
        );
      }
    });
  });

  // Test various network-dependent functionality of the credentials middleware around database keys
  describe("database keys", () => {
    let v10runQueryFromString;

    beforeEach(() => {
      // We need to use the original implementation of runQueryFromString to ensure it hits
      //   faunaClientV10.runQueryFromString which is where we force the 401 and test the refresh
      //   logic.
      container.register({
        runQueryFromString: awilix.asValue(originalRunQueryFromString),
      });
      v10runQueryFromString =
        container.resolve("faunaClientV10").runQueryFromString;
    });

    it("shows error when user provided database key is invalid", async () => {
      process.env.FAUNA_SECRET = "invalid-user-db-key";
      v10runQueryFromString.rejects({
        message: "Invalid credentials",
        httpStatus: 401,
      });
      try {
        await run(`query "Database.all()" --no-color --json`, container);
      } catch (e) {
        expect(stderr.getWritten()).to.contain("Invalid credentials");
        sinon.assert.calledWithMatch(
          v10runQueryFromString.getCall(0),
          sinon.match({
            expression: sinon.match(/Database\.all/),
            secret: "invalid-user-db-key",
          }),
        );
      }
    });

    it("refreshes database key", async () => {
      v10runQueryFromString
        .onCall(0)
        .rejects({
          error: {},
          httpStatus: 401,
        })
        .onCall(1)
        .resolves({
          data: [],
        });
      accountAPI.createKey.onCall(0).resolves({
        secret: "new-secret",
      });

      await run(
        `query "Database.all()" -d us-std --no-color --json`,
        container,
      );

      sinon.assert.calledWithMatch(
        v10runQueryFromString.getCall(0),
        sinon.match({
          expression: sinon.match(/Database\.all/),
          secret: "some-database-secret",
        }),
      );

      const credentials = container.resolve("credentials");
      expect(credentials.databaseKeys).to.deep.include({
        role: "admin",
        key: "new-secret",
        keySource: "credentials-file",
      });
    });
  });
});

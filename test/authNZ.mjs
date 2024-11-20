import * as awilix from "awilix";
import { expect } from "chai";
import { beforeEach } from "mocha";
import sinon, { stub } from "sinon";

import { run } from "../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../src/config/setup-test-container.mjs";
import { authNZMiddleware, setAccountKey } from "../src/lib/auth/authNZ.mjs";
import { AccountKey, SecretKey } from "../src/lib/file-util.mjs";
import { InvalidCredsError } from "../src/lib/misc.mjs";
import { f } from "./helpers.mjs";

describe("authNZMiddleware", function () {
  let container;
  let fetch;
  let logger;
  const validAccessKeyFile =
    '{"test-profile": { "accountKey": "valid-account-key", "refreshToken": "valid-refresh-token"}}';
  const validSecretKeyFile =
    '{"valid-account-key": { "test-db": {"admin": "valid-db-key"}}}';
  const mockAccountClient = () => {
    return {
      whoAmI: stub().resolves(true),
      createKey: stub().resolves({ secret: "new-db-key" }),
      refreshSession: stub().resolves({
        account_key: "new-account-key",
        refresh_token: "new-refresh-token",
      }),
    };
  };

  beforeEach(() => {
    container = setupContainer();
    container.register({
      accountClient: awilix.asFunction(mockAccountClient).scoped(),
      accountCreds: awilix.asClass(AccountKey).scoped(),
      secretCreds: awilix.asClass(SecretKey).scoped(),
    });
    fetch = container.resolve("fetch");
    logger = container.resolve("logger");
  });

  it("should pass through if authRequired is false", async function () {
    const argv = { authRequired: false };
    const result = await authNZMiddleware(argv);
    expect(fetch.called).to.be.false;
    expect(result).to.deep.equal(argv);
  });

  it("should prompt login if InvalidCredsError is thrown", async function () {
    const scope = container.createScope();
    const argv = { authRequired: true, profile: "test-profile" };
    await run("db list", scope);
    const exit = scope.resolve("exit");
    const accountCreds = scope.resolve("accountCreds");

    accountCreds.get = stub().throws(new InvalidCredsError());

    await authNZMiddleware(argv);
    expect(logger.stderr.args[0][0]).to.include("not signed in or has expired");
    expect(logger.stdout.args[0][0]).to.include(
      "To sign in, run:\n\nfauna login --profile test-profile\n",
    );
    expect(exit.calledOnce).to.be.true;
  });

  it("should refresh session if account key is invalid", async function () {
    const argv = { authRequired: true, profile: "test-profile" };
    const scope = container.createScope();

    await run("db list", scope);
    const accountCreds = scope.resolve("accountCreds");
    accountCreds.save = stub();

    const fs = scope.resolve("fs");
    fs.readFileSync.withArgs(sinon.match(/secret_keys/)).returns("{}");
    fs.readFileSync
      .withArgs(sinon.match(/access_keys/))
      .returns(validAccessKeyFile);

    const accountClient = scope.resolve("accountClient");
    accountClient.whoAmI.onFirstCall().throws(new InvalidCredsError());

    await authNZMiddleware(argv);
    expect(accountClient.refreshSession.calledOnce).to.be.true;
    expect(accountCreds.save.calledOnce).to.be.true;
    expect(accountCreds.save.args[0][0].creds).to.deep.equal({
      account_key: "new-account-key",
      refresh_token: "new-refresh-token",
    });
  });

  describe("Short term DB Keys", () => {
    let scope;
    let fs;

    const argv = {
      authRequired: true,
      profile: "test-profile",
      database: "test-db",
      url: "http://localhost",
      role: "admin",
    };
    beforeEach(() => {
      scope = container.createScope();
      scope.register({
        accountCreds: awilix.asClass(AccountKey).scoped(),
        secretCreds: awilix.asClass(SecretKey).scoped(),
      });
      fs = scope.resolve("fs");
      fs.readFileSync.callsFake((path) => {
        if (path.includes("access_keys")) {
          return validAccessKeyFile;
        } else {
          return validSecretKeyFile;
        }
      });
    });
    it("returns existing db key if it's valid", async function () {
      await run("db list", scope);

      const fetch = scope.resolve("fetch");
      const secretCreds = scope.resolve("secretCreds");
      fetch.resolves(f(true));
      secretCreds.save = stub();

      await authNZMiddleware(argv);
      // Check that setDBKey was called and secrets were saved
      expect(secretCreds.save.called).to.be.false;
    });

    it("creates a new db key if one doesn't exist", async function () {
      await run("db list", scope);

      const secretCreds = scope.resolve("secretCreds");
      fs.readFileSync.withArgs(sinon.match(/secret_keys/)).returns("{}");

      secretCreds.save = stub();

      await authNZMiddleware(argv);
      // Check that setDBKey was called and secrets were saved
      expect(secretCreds.save.called).to.be.true;
      expect(secretCreds.save.args[0][0].key).to.equal("valid-account-key");
      expect(secretCreds.save.args[0][0].creds).to.deep.equal({
        path: "test-db",
        role: "admin",
        secret: "new-db-key",
      });
    });

    it("should clean up secrets file during setAccountKey", async function () {
      await run("db list", scope);

      const secretCreds = scope.resolve("secretCreds");
      secretCreds.delete = stub();
      fs.readFileSync
        .withArgs(sinon.match(/secret_keys/))
        .returns('{"old-account-key": {"admin": "old-db-key"}}');

      await setAccountKey("test-profile");

      // Verify the cleanup secrets logic
      expect(secretCreds.delete.calledOnce).to.be.true;
    });
  });
});

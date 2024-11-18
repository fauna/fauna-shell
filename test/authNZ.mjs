import { expect } from "chai";
import {
  authNZMiddleware,
  setAccountKey,
  getAccountKey,
  cleanupSecretsFile,
} from "../src/lib/auth/authNZ.mjs";
import { setupTestContainer as setupContainer } from "../src/config/setup-test-container.mjs";
import * as awilix from "awilix";
import { stub, spy } from "sinon";
import { InvalidCredsError } from "../src/lib/misc.mjs";
import {
  AccountKey,
  SecretKey,
  CredsNotFoundError,
} from "../src/lib/file-util.mjs";

describe("authNZMiddleware", function () {
  let container;

  beforeEach(() => {
    container = setupContainer();
    fetch = container.resolve("fetch");
    logger = container.resolve("logger");
  });

  const mockAccountClient = () => {
    return {
      whoAmI: stub().resolves(true),
      createKey: stub().resolves({ secret: "new-secret" }),
      refreshSession: stub().resolves({
        account_key: "new-account-key",
        refresh_token: "new-refresh-token",
      }),
    };
  };

  it("should pass through if authRequired is false", async function () {
    const argv = { authRequired: false };
    const result = await authNZMiddleware(argv);
    expect(fetch.called).to.be.false;
    expect(result).to.deep.equal(argv);
  });

  it("should prompt login if InvalidCredsError is thrown", async function () {
    const argv = { authRequired: true, profile: "test-profile" };
    const accountCreds = container.resolve("accountCreds");
    const logger = container.resolve("logger");
    const exit = container.resolve("exit");

    stub(accountCreds, "get").throws(new InvalidCredsError());

    try {
      await authNZMiddleware(argv);
    } catch (e) {
      // We expect an exit here
      expect(logger.stderr.args[0][0]).to.include(
        "not signed in or has expired",
      );
      expect(exit.calledOnce).to.be.true;
    }
  });

  it("should refresh session if account key is invalid", async function () {
    const argv = { authRequired: true, profile: "test-profile" };
    const accountCreds = container.resolve("accountCreds");
    const accountClient = container.resolve("accountClient");

    stub(accountCreds, "get").returns({
      account_key: "invalid-key",
      refresh_token: "valid-token",
    });
    stub(accountClient, "whoAmI").throws(new InvalidCredsError());

    await authNZMiddleware(argv);
    expect(accountClient.refreshSession.calledOnce).to.be.true;
    expect(accountCreds.save.calledOnce).to.be.true;
  });

  it("should call setDBKey if database is provided", async function () {
    const argv = {
      authRequired: true,
      profile: "test-profile",
      database: "test-db",
      role: "admin",
      url: "http://localhost",
    };

    const accountCreds = container.resolve("accountCreds");
    stub(accountCreds, "get").returns({ account_key: "valid-key" });
    const result = await authNZMiddleware(argv);

    // Check that setDBKey was called and secrets were saved
    const secretCreds = container.resolve("secretCreds");
    expect(secretCreds.save.calledOnce).to.be.true;
  });

  it("should clean up secrets file during setAccountKey", async function () {
    const accountCreds = container.resolve("accountCreds");
    const secretCreds = container.resolve("secretCreds");
    stub(accountCreds, "get").returns({ account_key: "valid-key" });
    stub(secretCreds, "get").returns({});

    await setAccountKey("test-profile");

    // Verify the cleanup secrets logic
    expect(secretCreds.delete.calledOnce).to.be.true;
  });
});

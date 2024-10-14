import { expect } from "chai";
import { run } from "../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../src/config/setup-test-container.mjs";
import * as awilix from "awilix";
import { stub, spy } from "sinon";
import { AccountKey } from "../src/lib/file-util.mjs";

describe("login", function () {
  let container;
  let fs;
  const sessionCreds = {
    account_key: "account-key",
    refresh_token: "refresh-token",
  };
  const mockOAuth = () => {
    let handlers = {};

    return {
      _receiveAuthCode: spy(async () => {
        await handlers.auth_code_received();
      }),
      start: spy(async () => {
        await handlers.ready();
      }),
      getOAuthParams: () => {
        return {
          client_id: "client-id",
          redirect_uri: "redirect-uri",
          code_challenge: "challenge",
          code_challenge_method: "S256",
          response_type: "code",
          scope: "create_session",
          state: "state",
        };
      },
      getTokenParams: () => {
        return {
          clientId: "client-id",
          clientSecret: "client-secret",
          authCode: "auth-code",
          redirectURI: "redirect-uri",
          codeVerifier: "code-verifier",
        };
      },
      server: {
        on: (eventName, handler) => {
          handlers[eventName] = handler;
        },
      },
    };
  };
  const mockAccountClient = () => {
    return {
      startOAuthRequest: stub().resolves("dashboard-url"),
      listDatabases: stub().resolves("test databases"),
      getSession: stub().resolves(sessionCreds),
      getToken: stub().resolves({ access_token: "access-token" }),
    };
  };
  beforeEach(() => {
    container = setupContainer();
    container.register({
      oauthClient: awilix.asFunction(mockOAuth).scoped(),
      accountClient: awilix.asFunction(mockAccountClient).scoped(),
      accountCreds: awilix.asClass(AccountKey).scoped(),
    });
    fs = container.resolve("fs");
  });

  it("can login", async function () {
    // Run the command first so container is set.
    await run(`login`, container);
    // After container is set, we can get the mocks
    const oauthClient = container.resolve("oauthClient");
    const logger = container.resolve("logger");
    const accountCreds = container.resolve("accountCreds");
    const existingCreds = {
      test_profile: {
        account_key: "test",
        refresh_token: "test",
      },
    };
    const expectedCreds = {
      ...existingCreds,
      default: sessionCreds,
    };

    // We start the loopback server
    expect(oauthClient.start.called).to.be.true;
    // We open auth url in the browser and prompt user
    expect(container.resolve("open").calledWith("dashboard-url"));
    expect(
      logger.stdout.calledWith(
        "To login, open your browser to:\n dashboard-url",
      ),
    );
    accountCreds.get = stub().returns(existingCreds);
    // Trigger server event with mocked auth code
    await oauthClient._receiveAuthCode();
    // Show login success message
    expect(logger.stdout.args.flat()).to.include("Login Success!\n");
    // We save the session credentials alongside existing credential contents
    expect(accountCreds.filepath).to.include(".fauna/credentials/access_keys");
    expect(JSON.parse(fs.writeFileSync.args[0][1])).to.deep.equal(
      expectedCreds,
    );
  });

  it("overwrites credentials on login", async function () {
    const existingCreds = {
      test_profile: {
        account_key: "oldkey",
        refresh_token: "oldtoken",
      },
    };
    const expectedCreds = {
      test_profile: {
        account_key: "account-key",
        refresh_token: "refresh-token",
      },
    };
    await run(`login --profile test_profile`, container);
    const accountCreds = container.resolve("accountCreds");
    const oauthClient = container.resolve("oauthClient");
    const logger = container.resolve("logger");
    // Local file read returns old creds
    accountCreds.get = stub().returns(existingCreds);
    // Trigger server event with mocked auth code
    await oauthClient._receiveAuthCode();
    // Show login success message
    expect(logger.stdout.args.flat()).to.include("Login Success!\n");
    // We save the session credentials and overwrite the profile of the same name locally
    expect(JSON.parse(fs.writeFileSync.args[0][1])).to.deep.equal(
      expectedCreds,
    );
  });
});

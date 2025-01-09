//@ts-check

import * as awilix from "awilix";
import { expect } from "chai";
import sinon, { spy } from "sinon";

import { run } from "../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../src/config/setup-test-container.mjs";
import { f } from "./helpers.mjs";

describe("login", function () {
  let container, fs, fetch, getSession;
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

  beforeEach(() => {
    container = setupContainer();
    container.register({
      oauthClient: awilix.asFunction(mockOAuth).scoped(),
    });
    fs = container.resolve("fs");
    fetch = container.resolve("fetch");
    getSession = container.resolve("accountAPI").getSession;
    fetch
      .withArgs(
        sinon.match({ pathname: "/api/v1/oauth/authorize" }),
        sinon.match({
          method: "GET",
        }),
      )
      .resolves({
        headers: new Map([["location", "http://dashboard-url.com"]]),
        status: 302,
      })
      .withArgs(
        sinon.match({ pathname: "/api/v1/oauth/token" }),
        sinon.match({
          method: "POST",
        }),
      )
      .resolves(
        f({
          access_token: "access-token",
        }),
      );

    getSession.resolves({
      accountKey: "login-account-key",
      refreshToken: "login-refresh-token",
    });
  });

  it("can login", async function () {
    const existingCreds = {
      testUser: {
        accountKey: "test",
        refreshToken: "test",
      },
    };
    fs.readFileSync.returns(JSON.stringify(existingCreds));
    // Run the command first so container is set.
    await run(`login`, container);
    // After container is set, we can get the mocks
    const oauthClient = container.resolve("oauthClient");
    const logger = container.resolve("logger");
    const credentials = container.resolve("credentials");

    const expectedCreds = {
      ...existingCreds,
      default: {
        accountKey: "login-account-key",
        refreshToken: "login-refresh-token",
      },
    };

    // We start the loopback server
    expect(oauthClient.start.called).to.be.true;
    // We open auth url in the browser and prompt user
    expect(container.resolve("open").calledWith("http://dashboard-url.com"));
    expect(logger.stdout).to.have.been.calledWith(
      "To login, open your browser to:\nhttp://dashboard-url.com",
    );

    // Trigger server event with mocked auth code
    await oauthClient._receiveAuthCode();

    // We save the session credentials alongside existing credential contents
    expect(credentials.accountKeys.key).to.equal("login-account-key");
    expect(fs.writeFileSync.getCall(1).args[0]).to.include("access_keys");
    expect(JSON.parse(fs.writeFileSync.getCall(1).args[1])).to.deep.equal(
      expectedCreds,
    );
  });

  it("overwrites credentials on login", async function () {
    const existingCreds = {
      testUser: {
        accountKey: "oldkey",
        refreshToken: "oldtoken",
      },
    };

    // Local file read returns old creds
    fs.readFileSync.returns(JSON.stringify(existingCreds));
    await run(`login --user testUser`, container);
    const oauthClient = container.resolve("oauthClient");
    const expectedCreds = {
      testUser: {
        accountKey: "login-account-key",
        refreshToken: "login-refresh-token",
      },
    };
    // Trigger server event with mocked auth code
    await oauthClient._receiveAuthCode();

    // We save the session credentials and overwrite the profile of the same name locally
    expect(fs.writeFileSync.getCall(1).args[0]).to.include("access_keys");
    expect(JSON.parse(fs.writeFileSync.getCall(1).args[1])).to.deep.equal(
      expectedCreds,
    );
  });

  it("fast completes when using --local", async function () {
    await run(`login --local`, container);
    const logger = container.resolve("logger");
    expect(logger.stdout).to.have.been.calledWith(
      "Using a local Fauna container does not require login.\n",
    );
  });
});

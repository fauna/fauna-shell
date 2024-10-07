import { expect } from "chai";
import { run } from "../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../src/config/setup-test-container.mjs";
import * as awilix from "awilix/lib/awilix.module.mjs";
import { stub, spy } from "sinon";
import { AccountKey } from "../src/lib/file-util.mjs";

describe("login", function () {
  let container;
  let fs;
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
      getSession: stub().resolves({
        account_key: "account-key",
        refresh_token: "refresh-token",
      }),
      getToken: stub().resolves({ access_token: "access-token" }),
    };
  };
  beforeEach(() => {
    container = setupContainer();
    container.register({
      oauthClient: awilix.asFunction(mockOAuth).scoped(),
      accountClient: awilix.asFunction(mockAccountClient).scoped(),
      accountCreds: awilix.asClass(AccountKey),
    });
    fs = container.resolve("fs");
  });

  it("can login", async function () {
    const oauthClient = container.resolve("oauthClient");
    const logger = container.resolve("logger");
    const accountCreds = container.resolve("accountCreds");
    await run(`login`, container);

    // We start the loopback server
    expect(oauthClient.start.called).to.be.true;
    // We open auth url in the browser and prompt user
    expect(container.resolve("open").calledWith("dashboard-url"));
    expect(
      logger.stdout.calledWith(
        "To login, open your browser to:\n dashboard-url"
      )
    );
    fs.readFileSync.returns(
      JSON.stringify({
        default: {
          account_key: "test",
          refresh_token: "test",
        },
      })
    );
    // Trigger server event with mocked auth code
    await oauthClient._receiveAuthCode();
    // We create a session
    expect(logger.stdout.args.flat()).to.include("Login Success!\n");
    console.log(accountCreds);
    expect(accountCreds).to.have.been.called;
  });
});

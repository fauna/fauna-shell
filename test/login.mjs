//@ts-check

import { expect } from "chai";
import { stub } from "sinon";

import { run } from "../src/cli.mjs";
import { setupTestContainer as setupContainer } from "../src/config/setup-test-container.mjs";

describe("login", function () {
  let container;
  let fs;
  const sessionCreds = {
    accountKey: "account-key",
    refreshToken: "refresh-token",
  };

  beforeEach(() => {
    container = setupContainer();
    fs = container.resolve("fs");
  });

  it.skip("can login", async function () {
    // Run the command first so container is set.
    await run(`login`, container);
    // After container is set, we can get the mocks
    const oauthClient = container.resolve("oauthClient");
    const logger = container.resolve("logger");
    const accountCreds = container.resolve("accountCreds");
    const existingCreds = {
      testProfile: {
        accountKey: "test",
        refreshToken: "test",
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
    expect(logger.stdout).to.have.been.calledWith(
      "To login, open your browser to:\n dashboard-url",
    );
    accountCreds.get = stub().returns(existingCreds);
    // Trigger server event with mocked auth code
    await oauthClient._receiveAuthCode();
    // Show login success message
    expect(logger.stdout).to.have.been.calledWith("Login Success!\n");
    // We save the session credentials alongside existing credential contents
    expect(accountCreds.filepath).to.include(".fauna/credentials/access_keys");
    expect(JSON.parse(fs.writeFileSync.args[0][1])).to.deep.equal(
      expectedCreds,
    );
  });

  it.skip("overwrites credentials on login", async function () {
    const existingCreds = {
      testProfile: {
        accountKey: "oldkey",
        refreshToken: "oldtoken",
      },
    };
    const expectedCreds = {
      testProfile: {
        accountKey: "account-key",
        refreshToken: "refresh-token",
      },
    };
    await run(`login --profile testProfile`, container);
    const accountCreds = container.resolve("accountCreds");
    const oauthClient = container.resolve("oauthClient");
    const logger = container.resolve("logger");
    // Local file read returns old creds
    accountCreds.get = stub().returns(existingCreds);
    // Trigger server event with mocked auth code
    await oauthClient._receiveAuthCode();
    // Show login success message
    expect(logger.stdout).to.have.been.calledWith("Login Success!\n");
    // We save the session credentials and overwrite the profile of the same name locally
    expect(JSON.parse(fs.writeFileSync.args[0][1])).to.deep.equal(
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

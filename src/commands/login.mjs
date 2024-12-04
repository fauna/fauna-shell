//@ts-check

import { container } from "../cli.mjs";
import { yargsWithCommonOptions } from "../lib/command-helpers.mjs";
import { FaunaAccountClient } from "../lib/fauna-account-client.mjs";

async function doLogin() {
  const logger = container.resolve("logger");
  const open = container.resolve("open");
  const credentials = container.resolve("credentials");
  const oAuth = container.resolve("oauthClient");
  oAuth.server.on("ready", async () => {
    const authCodeParams = oAuth.getOAuthParams();
    const dashboardOAuthURL =
      await FaunaAccountClient.startOAuthRequest(authCodeParams);
    open(dashboardOAuthURL);
    logger.stdout(`To login, open your browser to:\n ${dashboardOAuthURL}`);
  });
  oAuth.server.on("auth_code_received", async () => {
    try {
      const tokenParams = oAuth.getTokenParams();
      const accessToken = await FaunaAccountClient.getToken(tokenParams);
      await credentials.login(accessToken);
      logger.stdout(`Login Success!\n`);
    } catch (err) {
      logger.stderr(err);
    }
  });
  await oAuth.start();
}

/**
 * Passthrough yargs until more functionality is added to the command
 * @param {*} yargs
 * @returns
 */
function buildLoginCommand(yargs) {
  return yargsWithCommonOptions(yargs, {
    user: {
      alias: "u",
      type: "string",
      description: "Name of account to register",
      default: "default",
      group: "login Options:",
    },
  });
}

export default {
  command: "login",
  describe: "Authenticate with Fauna.",
  builder: buildLoginCommand,
  handler: doLogin,
};

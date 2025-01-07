//@ts-check

import { input } from "@inquirer/prompts";

import { container } from "../cli.mjs";
import { yargsWithCommonOptions } from "../lib/command-helpers.mjs";
import { FaunaAccountClient } from "../lib/fauna-account-client.mjs";

async function doLogin(argv) {
  const logger = container.resolve("logger");
  if (argv.local) {
    logger.stdout(`Using a local Fauna container does not require login.\n`);
    return;
  }
  const open = container.resolve("open");
  const credentials = container.resolve("credentials");
  const oAuth = container.resolve("oauthClient");

  const loginWithToken = async () => {
    try {
      const tokenParams = oAuth.getTokenParams();
      const accessToken = await FaunaAccountClient.getToken(tokenParams);
      await credentials.login(accessToken);
      logger.stdout("Login successful.");
    } catch (err) {
      logger.stderr(err);
    }
  };

  const authCodeParams = oAuth.getOAuthParams(argv.noBrowser);
  const dashboardOAuthURL =
    await FaunaAccountClient.startOAuthRequest(authCodeParams);
  logger.stdout(`To login, open a browser to:\n${dashboardOAuthURL}`);
  if (!argv.noBrowser) {
    oAuth.server.on("ready", async () => {
      open(dashboardOAuthURL);
    });
    oAuth.server.on("auth_code_received", async () => {
      await loginWithToken();
    });
    await oAuth.start();
    logger.stdout("Waiting for authentication in browser to complete...");
  } else {
    try {
      const userCode = await input({
        message: "Authorization Code:",
      });
      try {
        const jsonString = atob(userCode);
        const parsed = JSON.parse(jsonString);
        const { code, state } = parsed;
        oAuth.validateAuthorizationCode(code, state);
        await loginWithToken();
      } catch (err) {
        logger.stderr(
          `Error during login: ${err.message}\nPlease restart login.`,
        );
      }
    } catch (err) {
      if (err.name === "ExitPromptError") {
        logger.stdout("Login canceled.");
      }
    }
  }
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
      description: "User to log in as.",
      default: "default",
    },
    noBrowser: {
      alias: "n",
      type: "boolean",
      description:
        "Login without a local callback server. Use this option if you are unable to open a browser on your local machine.",
      default: false,
    },
  }).example([
    ["$0 login", "Log in as the 'default' user."],
    ["$0 login --user john_doe", "Log in as the 'john_doe' user."],
    ["$0 login --no-browser", "Log in using a link."],
  ]);
}

export default {
  command: "login",
  describe: "Log in to Fauna.",
  builder: buildLoginCommand,
  handler: doLogin,
};

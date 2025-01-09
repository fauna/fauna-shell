//@ts-check

import { container } from "../config/container.mjs";
import { getToken, startOAuthRequest } from "../lib/account-api.mjs";

async function doLogin(argv) {
  const logger = container.resolve("logger");
  if (argv.local) {
    logger.stdout(`Using a local Fauna container does not require login.\n`);
    return;
  }
  const open = container.resolve("open");
  const credentials = container.resolve("credentials");
  const oAuth = container.resolve("oauthClient");
  const input = container.resolve("input");

  const loginWithToken = async () => {
    try {
      const { clientId, clientSecret, authCode, redirectURI, codeVerifier } =
        oAuth.getTokenParams({
          clientId: argv.clientId,
          clientSecret: argv.clientSecret,
        });

      /* eslint-disable camelcase */
      const accessToken = await getToken({
        client_id: clientId,
        client_secret: clientSecret,
        code: authCode,
        redirect_uri: redirectURI,
        code_verifier: codeVerifier,
      });
      /* eslint-enable camelcase */

      await credentials.login(accessToken);
      logger.stdout("Login successful.");
    } catch (err) {
      logger.stderr(err);
    }
  };
  const authCodeParams = oAuth.getOAuthParams({
    clientId: argv.clientId,
    noRedirect: argv.noRedirect,
  });
  const dashboardOAuthURL = await startOAuthRequest(authCodeParams);
  open(dashboardOAuthURL);
  logger.stdout(`To login, open a browser to:\n${dashboardOAuthURL}`);
  if (!argv.noRedirect) {
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
  return yargs
    .options({
      "account-url": {
        type: "string",
        description: "The Fauna account URL to query",
        default: "https://account.fauna.com",
        hidden: true,
      },
      "client-id": {
        type: "string",
        description: "the client id to use when calling Fauna",
        required: false,
        hidden: true,
      },
      "client-secret": {
        type: "string",
        description: "the client secret to use when calling Fauna",
        required: false,
        hidden: true,
      },
      "no-redirect": {
        alias: "n",
        type: "boolean",
        description:
          "Login without redirecting to a local callback server. Use this option if you are unable to open a browser on your local machine.",
        default: false,
      },
      user: {
        alias: "u",
        type: "string",
        description: "User to log in as.",
        default: "default",
      },
    })
    .example([
      ["$0 login", "Log in as the 'default' user."],
      ["$0 login --user john_doe", "Log in as the 'john_doe' user."],
    ]);
}

export default {
  command: "login",
  describe: "Log in to Fauna.",
  builder: buildLoginCommand,
  handler: doLogin,
};

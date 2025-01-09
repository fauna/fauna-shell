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
  oAuth.server.on("ready", async () => {
    const authCodeParams = oAuth.getOAuthParams({ clientId: argv.clientId });
    const dashboardOAuthURL = await startOAuthRequest(authCodeParams);
    open(dashboardOAuthURL);
    logger.stdout(`To login, open your browser to:\n${dashboardOAuthURL}`);
  });
  oAuth.server.on("auth_code_received", async () => {
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

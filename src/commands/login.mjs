//@ts-check

import { container } from "../cli.mjs";

async function doLogin(argv) {
  const logger = container.resolve("logger");
  const open = container.resolve("open");
  const accountClient = container.resolve("accountClient");
  const oAuth = container.resolve("oauthClient");
  const accountCreds = container.resolve("accountCreds");
  oAuth.server.on("ready", async () => {
    const authCodeParams = oAuth.getOAuthParams();
    const dashboardOAuthURL =
      await accountClient.startOAuthRequest(authCodeParams);
    open(dashboardOAuthURL);
    logger.stdout(`To login, open your browser to:\n ${dashboardOAuthURL}`);
  });
  oAuth.server.on("auth_code_received", async () => {
    try {
      const tokenParams = oAuth.getTokenParams();
      const accessToken = await accountClient.getToken(tokenParams);
      const { accountKey, refreshToken } =
        await accountClient.getSession(accessToken);
      accountCreds.save({
        creds: { accountKey, refreshToken },
        key: argv.profile,
      });
      logger.stdout(`Login Success!\n`);
    } catch (err) {
      logger.stderr(err);
    }
  });
  await oAuth.start();
}

function buildLoginCommand(yargs) {
  return yargs
    .options({
      profile: {
        type: "string",
        description: "a user profile",
        default: "default",
      },
    })
    .version(false)
    .help("help", "show help");
}

export default {
  builder: buildLoginCommand,
  handler: doLogin,
};
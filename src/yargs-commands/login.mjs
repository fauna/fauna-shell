import { builtYargs, container } from "../cli.mjs";

async function doLogin(argv) {
  const logger = container.resolve("logger");
  const open = container.resolve("open");
  const accountClient = container.resolve("accountClient");
  const oAuth = container.resolve("oauthClient");
  const accountCreds = container.resolve("accountCreds");
  if (!oAuth.server.listenerCount("ready")) {
    oAuth.server.on("ready", async () => {
      const authCodeParams = oAuth.getOAuthParams();
      const dashboardOAuthURL = await accountClient.startOAuthRequest(
        authCodeParams
      );
      open(dashboardOAuthURL);
      logger.stdout(`To login, open your browser to:\n ${dashboardOAuthURL}`);
    });
  }
  if (!oAuth.server.listenerCount("auth_code_received")) {
    oAuth.server.on("auth_code_received", async () => {
      try {
        const tokenParams = oAuth.getTokenParams();
        const accessToken = await accountClient.getToken(tokenParams);
        const { account_key, refresh_token } = await accountClient.getSession(
          accessToken
        );
        accountCreds.save({
          creds: { account_key, refresh_token },
          user: argv.user,
        });
        logger.stdout(`Login Success!\n\n`)
        logger.stdout("Listing Databases...");
        const databases = await accountClient.listDatabases(account_key);
        logger.stdout(databases);
      } catch (err) {
        console.error(err);
      }
    });
  }
  await oAuth.start();
}

function buildLoginCommand(yargs) {
  return yargs
    .options({
      user: {
        type: "string",
        description: "a user profile",
        default: "default",
      },
    })
    .help("help", "show help");
}

export default {
  builder: buildLoginCommand,
  handler: doLogin,
};

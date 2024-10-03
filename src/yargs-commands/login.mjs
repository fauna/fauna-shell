import { container } from '../cli.mjs'

async function doLogin(argv) {
  const logger = container.resolve("logger")
  const open = container.resolve("open")
  const accountClient = container.resolve("accountClient")
  const oAuth = container.resolve("oauthClient")

  oAuth.server.on("ready", async () => {
    const authCodeParams = oAuth.getOAuthParams();
    const dashboardOAuthURL = await accountClient.startOAuthRequest(authCodeParams);
    open(dashboardOAuthURL);
    logger.stdout(`To login, open your browser to:\n ${dashboardOAuthURL}`);
  });
  oAuth.server.on("auth_code_received", async () => {
    try {
      const tokenParams = oAuth.getTokenParams();
      const accessToken = await accountClient.getToken(tokenParams);
      const { account_key } = await accountClient.getSession(accessToken);
      logger.stdout("Listing Databases...");
      const databases = await accountClient.listDatabases(account_key);
      logger.stdout(databases)
    } catch (err) {
      console.error(err);
    }
  });

  await oAuth.start();
}

function buildLoginCommand(yargs) {
  return yargs.options({
    user: {
      type: "string",
      description: "a user profile",
      default: "default",
    },
  })
  .help('help', 'show help')
}

export default {
  builder: buildLoginCommand,
  handler: doLogin,
};

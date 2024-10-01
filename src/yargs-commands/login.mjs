import OAuthServer, { ACCOUNT_URL } from "../lib/auth/oauth-client.mjs";
import open from "open";
import { container } from '../cli.mjs'

async function run() {
  await this.execute();
}

async function getSession(access_token) {
  const myHeaders = new Headers();
  myHeaders.append("Authorization", `Bearer ${access_token}`);

  const requestOptions = {
    method: "POST",
    headers: myHeaders,
  };
  const response = await fetch(`${ACCOUNT_URL}/session`, requestOptions);
  if (response.status >= 400) {
    throw new Error(`Error creating session: ${response.statusText}`);
  }
  const session = await response.json();
  return session;
}

async function listDatabases(account_key) {
  const myHeaders = new Headers();
  myHeaders.append("Authorization", `Bearer ${account_key}`);

  const requestOptions = {
    method: "GET",
    headers: myHeaders,
  };
  const response = await fetch(`${ACCOUNT_URL}/databases`, requestOptions);
  if (response.status >= 400) {
    throw new Error(`Error listing databases: ${response.statusText}`);
  }
  const databases = await response.json();
  console.log(databases);
  return databases;
}

async function execute(argv) {
  const { user } = argv;
  const logger = await container.resolve("logger")


  const oAuth = new OAuthServer();
  await oAuth.start();
  oAuth.server.on("ready", async () => {
    const dashboardOAuthURL = (await fetch(oAuth.getRequestUrl())).url;
    const error = new URL(dashboardOAuthURL).searchParams.get("error");
    if (error) {
      throw new Error(`Error during login: ${error}`);
    }
    open(dashboardOAuthURL);
    logger.stdout(`To login, open your browser to:\n ${dashboardOAuthURL}`);
  });
  oAuth.server.on("auth_code_received", async () => {
    try {
      const tokenResponse = await oAuth.getToken();
      const token = await tokenResponse.json();
      logger.stdout("Authentication successful!");
      const { state, access_token } = token;
      if (state !== oAuth.state) {
        throw new Error("Error during login: invalid state.");
      }
      const session = await this.getSession(access_token);
      logger.stdout("Listing Databases...");
      await this.listDatabases(session.account_key);
    } catch (err) {
      console.error(err);
    }
  });
}

function buildLoginCommand(yargs) {
  return yargs.options({
    user: {
      type: "string",
      description: "a user profile",
      default: "default",
    },
  });
}

export default {
  builder: buildLoginCommand,
  handler: execute,
};

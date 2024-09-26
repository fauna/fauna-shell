import { Command } from "@oclif/core";
import OAuthServer, { ACCOUNT_URL } from "../lib/auth/oauth-client";
import open from "open";

type AccessToken = {
  access_token: string;
  token_type: string;
  ttl: string;
  state: string;
};

export default class LoginCommand extends Command {
  static description = "Login to your Fauna account.";
  static examples = ["$ fauna login"];
  static flags = {};

  async run() {
    await this.execute();
  }

  async getSession(access_token: string) {
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

  async listDatabases(account_key: string) {
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

  async execute() {

    const oAuth = new OAuthServer();
    await oAuth.start();
    oAuth.server.on("ready", async () => {
      const dashboardOAuthURL = (await fetch(oAuth.getRequestUrl())).url;
      const error = new URL(dashboardOAuthURL).searchParams.get("error");
      if (error) {
        throw new Error(`Error during login: ${error}`);
      }
      open(dashboardOAuthURL);
      this.log(`To login, open your browser to:\n ${dashboardOAuthURL}`);
    });
    oAuth.server.on("auth_code_received", async () => {
      try {
        const tokenResponse = await oAuth.getToken();
        const token: AccessToken = await tokenResponse.json();
        this.log("Authentication successful!");
        const { state, access_token } = token;
        if (state !== oAuth.state) {
          throw new Error("Error during login: invalid state.");
        }
        const session = await this.getSession(access_token);
        this.log("Listing databases...");
        await this.listDatabases(session.account_key);
      } catch (err) {
        console.error(err);
      }
    });
  }
}

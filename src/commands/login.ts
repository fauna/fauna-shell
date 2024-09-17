import { Command } from "@oclif/core";
import OAuthServer from "../lib/auth/oauth-client";

type AccessToken = {
  access_token: string;
  token_type: string;
  ttl: string;
  state: string;
};

// const DASHBOARD_URL = "http://localhost:3005/login";

export default class LoginCommand extends Command {
  static description = "Log in to a Fauna account.";
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

    const response = await fetch(
      "http://localhost:8000/api/v1/session",
      requestOptions
    );
    const session = await response.json();
    return session;
  }

  async execute() {
    await this.parse();

    const oAuth = new OAuthServer();
    const authUrl = (await fetch(oAuth.getRequestUrl())).url;
    await oAuth.start();
    this.log(`To login, open your browser to:\n ${authUrl}`);
    oAuth.server.on("auth_code_received", async () => {
      try {
        const token: AccessToken = await (await oAuth.getToken()).json();
        this.log("Authentication successful!");
        const { state, ttl, access_token, token_type } = token;
        if (state !== oAuth.state) {
          throw new Error("Error during login: invalid state.");
        }
        const session = await this.getSession(access_token);
        this.log("Session created:", session);
      } catch (err) {
        console.error(err);
      }
    });
  }
}

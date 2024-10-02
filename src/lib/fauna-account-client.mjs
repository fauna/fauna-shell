export class FaunaAccountClient {
  constructor() {
    this.url = process.env.FAUNA_ACCOUNT_URL ?? "https://account.fauna.com/api/v1";
  }

  async startOAuthRequest(authCodeParams) {
    const OAuthUrl = `${this.url}/api/v1/oauth/authorize?${new URLSearchParams(
      authCodeParams
    )}`;
    const dashboardOAuthURL = (await fetch(OAuthUrl)).url;
    const error = new URL(dashboardOAuthURL).searchParams.get("error");
    if (error) {
      throw new Error(`Error during login: ${error}`);
    }
    return dashboardOAuthURL;
  }

  async getToken(opts) {
    const params = {
      grant_type: "authorization_code",
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      code: opts.authCode,
      redirect_uri: opts.redirectURI,
      code_verifier: opts.codeVerifier,
    };
    try {
      const response = await fetch(`${this.url}/api/v1/oauth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(params),
      });
      if (response.status >= 400) {
        throw new Error(
          `Failure to authorize with Fauna (${response.status}): ${response.statusText}`
        );
      }
      const { state, access_token } = await response.json();
      return access_token;
    } catch (err) {
      throw new Error("Failure to authorize with Fauna: ", err.message);
    }
  }

  // TODO: remove access_token param and use credential manager helper
  async getSession(accessToken) {
    const headers = new Headers();
    headers.append("Authorization", `Bearer ${accessToken}`);

    const requestOptions = {
      method: "POST",
      headers,
    };
    try {
      const response = await fetch(
        `${this.url}/api/v1/session`,
        requestOptions
      );
      if (response.status >= 400) {
        throw new Error(
          `Error creating session (${response.status}): ${response.statusText}`
        );
      }
      const session = await response.json();
      return session;
    } catch (err) {
      throw new Error(
        "Failure to create session with Fauna: ",
        JSON.stringify(err)
      );
    }
  }

  // TODO: remove account_key param and use credential manager helper
  async listDatabases(account_key) {
    const headers = new Headers();
    headers.append("Authorization", `Bearer ${account_key}`);
    const requestOptions = {
      method: "GET",
      headers,
    };
    try {
      const response = await fetch(
        `${this.url}/api/v1/databases`,
        requestOptions
      );
      if (response.status >= 400) {
        throw new Error(
          `Error listing databases (${response.status}): ${response.statusText}`
        );
      }
      const databases = await response.json();
      return databases;
    } catch (err) {
      throw new Error("Failure to list databases: ", err.message);
    }
  }
}

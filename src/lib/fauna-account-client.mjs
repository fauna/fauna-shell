//@ts-check

import { container } from "../cli.mjs";

/**
 * Class representing a client for interacting with the Fauna account API.
 */
export class FaunaAccountClient {
  /**
   * Creates an instance of FaunaAccountClient.
   */
  constructor() {
    /**
     * The base URL for the Fauna account API.
     * @type {string}
     */
    this.url =
      process.env.FAUNA_ACCOUNT_URL ?? "https://account.fauna.com/api/v1";

    /**
     * The fetch function for making HTTP requests.
     * @type {Function}
     */
    this.fetch = container.resolve("fetch");
  }

  /**
   * Starts an OAuth request to the Fauna account API.
   *
   * @param {Object} authCodeParams - The parameters for the OAuth authorization code request.
   * @returns {Promise<string>} - The URL to the Fauna dashboard for OAuth authorization.
   * @throws {Error} - Throws an error if there is an issue during login.
   */
  async startOAuthRequest(authCodeParams) {
    const OAuthUrl = `${this.url}/api/v1/oauth/authorize?${new URLSearchParams(
      authCodeParams
    )}`;
    const dashboardOAuthURL = (await this.fetch(OAuthUrl)).url;
    const error = new URL(dashboardOAuthURL).searchParams.get("error");
    if (error) {
      throw new Error(`Error during login: ${error}`);
    }
    return dashboardOAuthURL;
  }

  /**
   * Retrieves an access token from the Fauna account API.
   *
   * @param {Object} opts - The options for the token request.
   * @param {string} opts.clientId - The client ID for the OAuth application.
   * @param {string} opts.clientSecret - The client secret for the OAuth application.
   * @param {string} opts.authCode - The authorization code received from the OAuth authorization.
   * @param {string} opts.redirectURI - The redirect URI for the OAuth application.
   * @param {string} opts.codeVerifier - The code verifier for the OAuth PKCE flow.
   * @returns {Promise<string>} - The access token.
   * @throws {Error} - Throws an error if there is an issue during token retrieval.
   */
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
      const response = await this.fetch(`${this.url}/api/v1/oauth/token`, {
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
      const { access_token } = await response.json();
      return access_token;
    } catch (err) {
      throw new Error("Failure to authorize with Fauna: " + err.message);
    }
  }

  /**
   * Retrieves the session information from the Fauna account API.
   *
   * @param {string} accessToken - The access token for the session.
   * @returns {Promise<{account_key: string, refresh_token: string}>} - The session information.
   * @throws {Error} - Throws an error if there is an issue during session retrieval.
   */
  async getSession(accessToken) {
    const headers = new Headers();
    headers.append("Authorization", `Bearer ${accessToken}`);

    const requestOptions = {
      method: "GET",
      headers,
    };
    try {
      const response = await this.fetch(
        `${this.url}/api/v1/session`,
        requestOptions
      );
      if (response.status >= 400) {
        throw new Error(
          `Failure to get session with Fauna (${response.status}): ${response.statusText}`
        );
      }
      return await response.json();
    } catch (err) {
      throw new Error("Failure to get session with Fauna: " + err.message);
    }
  }

  /**
   * Lists databases associated with the given account key.
   *
   * @param {string} accountKey - The account key to list databases for.
   * @returns {Promise<Object[]>} - The list of databases.
   * @throws {Error} - Throws an error if there is an issue during the request.
   */
  async listDatabases(accountKey) {
    const headers = new Headers();
    headers.append("Authorization", `Bearer ${accountKey}`);

    const requestOptions = {
      method: "GET",
      headers,
    };
    try {
      const response = await this.fetch(
        `${this.url}/api/v1/databases`,
        requestOptions
      );
      if (response.status >= 400) {
        throw new Error(
          `Failure to list databases. (${response.status}): ${response.statusText}`
        );
      }
      return await response.json();
    } catch (err) {
      throw new Error("Failure to list databases with Fauna: " + err.message);
    }
  }
}

//@ts-check

import { container } from "../cli.mjs";
import { getAccountKey, promptLogin, refreshSession } from "./auth/authNZ.mjs";
import { InvalidCredsError } from "./misc.mjs";

/**
 * Class representing a client for interacting with the Fauna account API.
 */
export class FaunaAccountClient {
  constructor(profile, url) {
    const { accountKey, refreshToken } = getAccountKey(profile);
    this.accountKey = accountKey;
    this.refreshToken = refreshToken;
    this.profile = profile;
    this.url = url;
    this.makeAccountRequest = async (args) => {
      const original = container.resolve("makeAccountRequest");
      const logger = container.resolve("logger");
      let result;
      try {
        result = await original(args);
      } catch (e) {
        if (e instanceof InvalidCredsError) {
          logger.debug("401 in account api, attempting to refresh session");
          try {
            const { accountKey: newAccountKey, refreshToken: newRefreshToken } =
              await refreshSession(this.profile);
            this.accountKey = newAccountKey;
            this.refreshToken = newRefreshToken;
            return await original({
              ...args,
              secret: this.accountKey,
            });
          } catch (e) {
            if (e instanceof InvalidCredsError) {
              logger.debug(
                "Failed to refresh session, expired or missing refresh token",
              );
              promptLogin();
            } else {
              throw e;
            }
          }
        } else {
          throw e;
        }
      }
      return result;
    };
  }

  /**
   * Starts an OAuth request to the Fauna account API.
   *
   * @param {Object} authCodeParams - The parameters for the OAuth authorization code request.
   * @returns {Promise<string>} - The URL to the Fauna dashboard for OAuth authorization.
   * @throws {Error} - Throws an error if there is an issue during login.
   */
  async startOAuthRequest(authCodeParams) {
    const oauthRedirect = await this.makeAccountRequest({
      path: "/oauth/authorize",
      method: "GET",
      params: authCodeParams,
      contentType: "text/html",
    });
    if (oauthRedirect.status !== 302) {
      throw new Error(
        `Failed to start OAuth request: ${oauthRedirect.status} - ${oauthRedirect.statusText}`,
      );
    }
    const dashboardOAuthURL = oauthRedirect.headers.get("location");
    const error = new URL(dashboardOAuthURL).searchParams.get("error");
    if (error) {
      throw new Error(`Error during login: ${error}`);
    }
    return dashboardOAuthURL;
  }

  async whoAmI() {
    return await this.makeAccountRequest({
      method: "GET",
      path: "/whoami",
      secret: this.accountKey,
    });
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
      grant_type: "authorization_code", // eslint-disable-line camelcase
      client_id: opts.clientId, // eslint-disable-line camelcase
      client_secret: opts.clientSecret, // eslint-disable-line camelcase
      code: opts.authCode,
      redirect_uri: opts.redirectURI, // eslint-disable-line camelcase
      code_verifier: opts.codeVerifier, // eslint-disable-line camelcase
    };
    try {
      const response = await this.makeAccountRequest({
        method: "POST",
        contentType: "application/x-www-form-urlencoded",
        body: new URLSearchParams(params).toString(),
        path: "/oauth/token",
      });
      const { access_token: accessToken } = response;
      return accessToken;
    } catch (err) {
      err.message = `Failure to authorize with Fauna: ${err.message}`;
      throw err;
    }
  }

  /**
   * Retrieves the session information from the Fauna account API.
   *
   * @param {string} accessToken - The access token for the session.
   * @returns {Promise<{accountKey: string, refreshToken: string}>} - The session information.
   * @throws {Error} - Throws an error if there is an issue during session retrieval.
   */
  async getSession(accessToken) {
    try {
      const { account_key: accountKey, refresh_token: refreshToken } =
        await this.makeAccountRequest({
          method: "POST",
          path: "/session",
          secret: accessToken,
        });
      return { accountKey, refreshToken };
    } catch (err) {
      err.message = `Failure to get session with Fauna: ${err.message}`;
      throw err;
    }
  }
  /**
   * Lists databases associated with the given account key.
   *
   * @returns {Promise<Object[]>} - The list of databases.
   * @throws {Error} - Throws an error if there is an issue during the request.
   */
  async listDatabases() {
    try {
      return this.makeAccountRequest({
        method: "GET",
        path: "/databases",
        secret: this.accountKey,
      });
    } catch (err) {
      err.message = `Failure to list databases: ${err.message}`;
      throw err;
    }
  }

  /**
   * Creates a new key for a specified database.
   *
   * @param {Object} params - The parameters for creating the key.
   * @param {string} params.path - The path of the database, including region group
   * @param {string} [params.role] - The builtin role for the key. Default admin.
   * @returns {Promise<Object>} - A promise that resolves when the key is created.
   * @throws {Error} - Throws an error if there is an issue during key creation.
   */
  async createKey({ path, role = "admin" }) {
    // TODO: specify a ttl
    return await this.makeAccountRequest({
      method: "POST",
      path: "/databases/keys",
      body: JSON.stringify({
        path,
        role,
      }),
      secret: this.accountKey,
    });
  }
}

//@ts-check

import { container } from "../cli.mjs";
import { InvalidCredsError, UnauthorizedError } from "./misc.mjs";

/**
 *
 * @param {Object} opts
 * @param {string} [opts.body] - The body of the request. JSON or form-urlencoded string
 * @param {any} [opts.params] - The query parameters of the request
 * @param {string} [opts.contentType] - The content type of the request
 * @param {string} opts.method - The HTTP method of the request
 * @param {string} opts.path - The path of the request to append to base fauna account URL
 * @param {string} [opts.secret] - The secret key to use for the request
 * @param {boolean} [opts.shouldThrow] - Whether or not to throw an error if the request fails
 * @returns {Promise<Response | Object>} - The response from the request
 */
export async function makeAccountRequest({
  secret = "",
  path,
  params = undefined,
  method,
  body = undefined,
  shouldThrow = true,
  contentType = "application/json",
}) {
  const fetch = container.resolve("fetch");
  const baseUrl = process.env.FAUNA_ACCOUNT_URL ?? "https://account.fauna.com";
  const paramsString = params ? `?${new URLSearchParams(params)}` : "";
  let fullUrl;

  try {
    fullUrl = new URL(`/api/v1${path}${paramsString}`, baseUrl).href;
  } catch (e) {
    e.message = `Could not build valid URL out of base url (${baseUrl}), path (${path}), and params string (${paramsString}) built from params (${JSON.stringify(
      params,
    )}).`;
    throw e;
  }

  const fetchArgs = {
    method,
    headers: {
      AUTHORIZATION: `Bearer ${secret}`,
      "content-type": contentType,
    },
  };

  if (body) fetchArgs.body = body;

  const response = await fetch(fullUrl, fetchArgs);
  const responseType = response.headers.get("content-type");
  const responseIsJSON = responseType?.includes("application/json");
  if (response.status >= 400 && shouldThrow) {
    let message = `Failed to make request to Fauna account API [${response.status}]`;
    if (responseIsJSON) {
      const body = await response.json();
      const { reason, code } = body;
      message += `: ${code} - ${reason}`;
    }
    switch (response.status) {
      case 401:
        throw new InvalidCredsError(message);
      case 403:
        throw new UnauthorizedError(message);
      default:
        throw new Error(message);
    }
  }
  const result = responseIsJSON ? await response.json() : await response;

  return result;
}

/**
 * Class representing a client for interacting with the Fauna account API.
 */
export class FaunaAccountClient {
  /**
   * Starts an OAuth request to the Fauna account API.
   *
   * @param {Object} authCodeParams - The parameters for the OAuth authorization code request.
   * @returns {Promise<string>} - The URL to the Fauna dashboard for OAuth authorization.
   * @throws {Error} - Throws an error if there is an issue during login.
   */
  static async startOAuthRequest(authCodeParams) {
    const dashboardOAuthURL = (
      await makeAccountRequest({
        path: "/oauth/authorize",
        method: "GET",
        params: authCodeParams,
      })
    ).url;
    const error = new URL(dashboardOAuthURL).searchParams.get("error");
    if (error) {
      throw new Error(`Error during login: ${error}`);
    }
    return dashboardOAuthURL;
  }

  static async whoAmI(accountKey) {
    return await makeAccountRequest({
      method: "GET",
      path: "/whoami",
      secret: accountKey,
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
  static async getToken(opts) {
    const params = {
      grant_type: "authorization_code", // eslint-disable-line camelcase
      client_id: opts.clientId, // eslint-disable-line camelcase
      client_secret: opts.clientSecret, // eslint-disable-line camelcase
      code: opts.authCode,
      redirect_uri: opts.redirectURI, // eslint-disable-line camelcase
      code_verifier: opts.codeVerifier, // eslint-disable-line camelcase
    };
    try {
      const response = await makeAccountRequest({
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
  static async getSession(accessToken) {
    try {
      const { account_key: accountKey, refresh_token: refreshToken } =
        await makeAccountRequest({
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

  static async refreshSession(refreshToken) {
    return await makeAccountRequest({
      method: "POST",
      path: "/session/refresh",
      secret: refreshToken,
    });
  }

  /**
   * Lists databases associated with the given account key.
   *
   * @param {string} accountKey - The account key to list databases for.
   * @returns {Promise<Object[]>} - The list of databases.
   * @throws {Error} - Throws an error if there is an issue during the request.
   */
  static async listDatabases(accountKey) {
    try {
      const response = await makeAccountRequest({
        method: "GET",
        path: "/databases",
        secret: accountKey,
      });
      return await response.json();
    } catch (err) {
      err.message = `Failure to list databases: ${err.message}`;
      throw err;
    }
  }

  /**
   * Creates a new key for a specified database.
   *
   * @param {Object} params - The parameters for creating the key.
   * @param {string} params.accountKey - The account key for authentication.
   * @param {string} params.path - The path of the database, including region group
   * @param {string} [params.role] - The builtin role for the key. Default admin.
   * @returns {Promise<Object>} - A promise that resolves when the key is created.
   * @throws {Error} - Throws an error if there is an issue during key creation.
   */
  static async createKey({ accountKey, path, role = "admin" }) {
    // TODO: specify a ttl
    return await makeAccountRequest({
      method: "POST",
      path: "/databases/keys",
      body: JSON.stringify({
        path,
        role,
      }),
      secret: accountKey,
    });
  }
}

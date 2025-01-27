//@ts-check
/* eslint-disable max-lines */

import { container } from "../config/container.mjs";
import {
  AuthenticationError,
  AuthorizationError,
  CommandError,
} from "./errors.mjs";
import { standardizeRegion } from "./utils.mjs";

const API_VERSIONS = {
  v1: "/api/v1",
  v2: "/v2",
};

export const ExportState = {
  Pending: "Pending",
  InProgress: "InProgress",
  Complete: "Complete",
  Failed: "Failed",
};

export const EXPORT_STATES = Object.values(ExportState);

let accountUrl = process.env.FAUNA_ACCOUNT_URL ?? "https://account.fauna.com";

/**
 * References the account URL set in the account-api module.
 * @returns {string} The account URL
 */
export function getAccountUrl() {
  return accountUrl;
}

/**
 * Sets the account URL for the account-api module.
 * @param {string} url - The account URL to set
 */
export function setAccountUrl(url) {
  accountUrl = url;
}

/**
 * Infer the dashboard URL to use for login redirect URI
 * @returns {string} The dashboard URL
 */
export function getDashboardUrl() {
  if (process.env.FAUNA_DASHBOARD_URL) {
    return process.env.FAUNA_DASHBOARD_URL;
  }
  switch (accountUrl) {
    case "https://account.fauna-dev.com":
      return "https://dashboard.fauna-dev.com";
    case "https://account.fauna-preview.com":
      return "https://dashboard.fauna-preview.com";
    case "http://localhost:8000":
      return "http://localhost:3005";
    default:
      return "https://dashboard.fauna.com";
  }
}

/**
 * Builds a URL for the account API
 *
 * @param {Object} opts
 * @param {string} opts.endpoint - The endpoint to append to the account URL
 * @param {Object} [opts.params] - The query parameters to append to the URL
 * @param {string} [opts.version] - The API version to use, defaults to v1
 * @returns {URL} The constructed URL
 */
export function toResource({
  endpoint,
  params = {},
  version = API_VERSIONS.v1,
}) {
  const url = new URL(`${version}${endpoint}`, getAccountUrl());
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((v) => url.searchParams.append(key, v));
    } else {
      url.searchParams.set(key, value);
    }
  }

  return url;
}

/**
 * Fetches the account API using an account key with a retry mechanism for 401s.
 * No secret needs to be provided, as the account key is refreshed as needed.
 *
 * @param {string | URL} url - The URL to fetch
 * @param {Object} options - The request options
 * @returns {Promise<Response>} The response from the account API
 */
export async function fetchWithAccountKey(url, options) {
  const logger = container.resolve("logger");
  const fetch = container.resolve("fetch");
  const accountKeys = container.resolve("credentials").accountKeys;

  let response = await fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${accountKeys.key}` },
  });

  if (response.status !== 401) {
    return response;
  }

  logger.debug("Retryable 401 error, attempting to refresh session", "creds");

  await accountKeys.onInvalidCreds();

  response = await fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${accountKeys.key}` },
  });

  if (response.status === 401) {
    logger.debug(
      "Failed to refresh session, expired or missing refresh token",
      "creds",
    );
    accountKeys.promptLogin();
  }

  return response;
}

/**
 * Parses an error response from the account API. v1 endpoints return code and reason values
 * directly in the body. v2 endpoints return an error object with code and message properties.
 *
 * @param {Object} body - The JSON body of the response
 * @returns {Object} - The error code and message
 */
export const parseErrorResponse = (body) => {
  let { code, message, metadata } = {
    code: "unknown_error",
    message:
      "The Account API responded with an error, but no error details were provided.",
    metadata: {},
  };

  if (!body) {
    return { code, message, metadata };
  }

  // v2 endpoints return an error object with code, message, and metadata properties
  if (body.error) {
    ({ code, message, metadata } = body.error);
  } else {
    // v1 endpoints return code and reason values directly in the body
    ({ code, reason: message } = body);
  }

  return { code, message, metadata };
};

/**
 * Throws an error based on the status code of the response
 *
 * @param {Response} response
 * @throws {AuthenticationError | AuthorizationError | CommandError | Error}
 */
export async function accountToCommandError(response) {
  let { code, message, metadata, body } = {};

  try {
    body = await response.json();
    ({ message, code, metadata } = parseErrorResponse(body));
  } catch (e) {
    code = "unknown_error";
    message =
      "An unknown error occurred while making a request to the Account API.";
  }

  // If consumers want to do more with this, they analyze the cause
  const responseAsCause = Object.assign(new Error(message), {
    status: response.status,
    body,
    headers: response.headers,
    code,
    message,
    metadata,
  });

  switch (response.status) {
    case 401:
      throw new AuthenticationError({ cause: responseAsCause });
    case 403:
      throw new AuthorizationError({ cause: responseAsCause });
    case 400:
    case 404:
      throw new CommandError(message, {
        cause: responseAsCause,
        hideHelp: true,
      });
    default:
      // @ts-ignore
      throw new Error(message, { cause: responseAsCause });
  }
}

/**
 * Handles the response from the account API.
 * @param {Response} response - The response from the account API
 * @returns {Promise<Object>} The JSON body of the response
 * @throws {AuthorizationError | AuthenticationError | CommandError | Error} If the response is not OK
 */
export async function responseHandler(response) {
  if (!response.ok) {
    await accountToCommandError(response);
  }

  return await response.json();
}

/**
 * Starts an OAuth request.
 * @param {Object} params - The parameters for the OAuth request
 * @param {string} params.client_id - The client ID
 * @param {string} params.redirect_uri - The redirect URI
 * @param {string} params.code_challenge - The code challenge
 * @param {string} params.code_challenge_method - The code challenge method
 * @param {string} params.response_type - The response type
 * @param {string} params.scope - The scope
 * @param {string} params.state - The state
 * @returns {Promise<string>} The URL to redirect the user to
 * @throws {Error} If the response is not OK
 */
export async function startOAuthRequest(params) {
  const fetch = container.resolve("fetch");
  const url = toResource({ endpoint: "/oauth/authorize", params });

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "content-type": "text/html",
    },
    redirect: "manual",
  });

  if (response.status !== 302) {
    throw new Error(
      `Failed to start OAuth request: ${response.status} - ${response.statusText}`,
    );
  }

  const dashboardOAuthURL = response.headers.get("location");
  if (!dashboardOAuthURL) {
    throw new Error("No location header found in response");
  }

  const error = new URL(dashboardOAuthURL).searchParams.get("error");
  if (error) {
    throw new Error(`Error during login: ${error}`);
  }

  return dashboardOAuthURL;
}

/**
 * Gets an access token from the account API.
 * @param {Object} params - The parameters for the access token request
 * @param {string} params.client_id - The client ID
 * @param {string} params.client_secret - The client secret
 * @param {string} params.code - The authorization code
 * @param {string} params.redirect_uri - The redirect URI
 * @param {string} params.code_verifier - The code verifier
 * @returns {Promise<string>} The access token
 */
export async function getToken(params) {
  const fetch = container.resolve("fetch");
  const url = toResource({ endpoint: "/oauth/token" });
  const body = new URLSearchParams({
    ...params,
    grant_type: "authorization_code", // eslint-disable-line camelcase
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new AuthorizationError(
      `Unable to get token while authorizing with Fauna`,
      { cause: response },
    );
  }

  const { access_token: accessToken } = await response.json();

  return accessToken;
}

/**
 * Gets a session from the account API.
 * @param {string} accessToken - The access token
 * @returns {Promise<Object>} The session
 * @throws {AuthorizationError | AuthenticationError | CommandError | Error} If the response is not OK
 */
async function getSession(accessToken) {
  const fetch = container.resolve("fetch");
  const url = toResource({ endpoint: "/session" });
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const { account_key: accountKey, refresh_token: refreshToken } =
    await responseHandler(response);

  return { accountKey, refreshToken };
}

/**
 * Refreshes a session from the account API.
 * @param {string} refreshToken - The refresh token
 * @returns {Promise<Object>} The session
 * @throws {AuthorizationError | AuthenticationError | CommandError | Error} If the response is not OK
 */
async function refreshSession(refreshToken) {
  const fetch = container.resolve("fetch");
  const url = toResource({ endpoint: "/session/refresh" });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${refreshToken}`,
    },
  });

  const { account_key: newAccountKey, refresh_token: newRefreshToken } =
    await responseHandler(response);

  return { accountKey: newAccountKey, refreshToken: newRefreshToken };
}

/**
 * List all databases for the current account.
 *
 * @param {Object} [params] - The parameters for listing databases.
 * @param {string} [params.path] - The path of the database, including region group
 * @param {number} [params.pageSize] - The number of databases to return per page
 * @returns {Promise<Object>} - A promise that resolves to the list of databases
 * @throws {AuthorizationError | AuthenticationError | CommandError | Error} If the response is not OK
 */
async function listDatabases(params = {}) {
  const { path, pageSize = 1000 } = params;
  const url = toResource({
    endpoint: "/databases",
    params: {
      max_results: pageSize, // eslint-disable-line camelcase
      ...(path ? { path: standardizeRegion(path) } : {}),
    },
  });

  const response = await fetchWithAccountKey(url, {
    method: "GET",
  });
  return await responseHandler(response);
}

/**
 * Creates a new key for a specified database.
 *
 * @param {Object} params - The parameters for creating the key.
 * @param {string} params.path - The path of the database, including region group
 * @param {string} params.role - The builtin role for the key.
 * @param {string | undefined} params.ttl - ISO String for the key's expiration time, optional
 * @param {string | undefined} params.name - The name for the key, optional
 * @returns {Promise<Object>} - A promise that resolves when the key is created.
 * @throws {AuthorizationError | AuthenticationError | CommandError | Error} If the response is not OK
 */
async function createKey({ path, role, ttl, name }) {
  const url = toResource({ endpoint: "/databases/keys" });

  const response = await fetchWithAccountKey(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      role,
      path: standardizeRegion(path),
      ttl,
      name,
    }),
  });

  return await responseHandler(response);
}

const getExportUri = (data) => {
  const { destination, state } = data;
  if (!destination || !state) {
    return "";
  }
  const path = destination.s3.path.replace(/^\/+/, "");
  return `s3://${destination.s3.bucket}/${path}`;
};

/**
 * Creates an export for a given database.
 *
 * @param {Object} params - The parameters for creating the export.
 * @param {string} params.database - The path of the database, including region group.
 * @param {string[] | undefined} [params.collections] - The collections to export.
 * @param {Object} params.destination - The destination for the export.
 * @param {Object} params.destination.s3 - The S3 destination for the export.
 * @param {string} params.destination.s3.bucket - The name of the S3 bucket to export to.
 * @param {string} params.destination.s3.path - The key prefix to export to.
 * @param {string} params.format - The format for the export.
 * @returns {Promise<Object>} - A promise that resolves when the export is created.
 * @throws {AuthorizationError | AuthenticationError | CommandError | Error} If the response is not OK
 */
async function createExport({
  database,
  destination,
  format,
  collections = undefined,
}) {
  const url = toResource({ endpoint: "/exports", version: API_VERSIONS.v2 });
  const response = await fetchWithAccountKey(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      database: standardizeRegion(database),
      destination,
      format,
      ...(collections && collections.length > 0 ? { collections } : {}),
    }),
  });

  const data = await responseHandler(response);
  return { ...data.response, destination: data.response.destination.uri };
}

/**
 * Lists exports associated with the given account key.
 *
 * @param {Object} [params] - The parameters for listing the exports.
 * @param {number} [params.maxResults] - The number of exports to return. Default 16.
 * @param {string} [params.nextToken] - The next token for pagination.
 * @param {string[]} [params.state] - The states to filter exports by.
 * @returns {Promise<Object>} - A promise that resolves when the exports are listed.
 * @throws {AuthorizationError | AuthenticationError | CommandError | Error} If the response is not OK
 */
async function listExports({ maxResults = 100, nextToken, state } = {}) {
  const url = toResource({
    endpoint: "/exports",
    version: API_VERSIONS.v2,
    params: {
      /* eslint-disable camelcase */
      max_results: maxResults,
      ...(nextToken && { next_token: nextToken }),
      ...(state && state.length > 0 ? { state } : {}),
      /* eslint-enable camelcase */
    },
  });

  const response = await fetchWithAccountKey(url, {
    method: "GET",
  });
  const { response: data } = await responseHandler(response);

  if (data.results && Array.isArray(data.results)) {
    data.results.forEach((r) => {
      r.destination_uri = getExportUri(r); // eslint-disable-line camelcase
    });
  }

  return data;
}

/**
 * Get an export by ID.
 *
 * @param {Object} params - The parameters for getting the export.
 * @param {string} params.exportId - The ID of the export to get.
 * @returns {Promise<Object>} - A promise that resolves when the export is retrieved.
 * @throws {AuthorizationError | AuthenticationError | CommandError | Error} If the response is not OK
 */
async function getExport({ exportId }) {
  const url = toResource({
    endpoint: `/exports/${exportId}`,
    version: API_VERSIONS.v2,
  });
  const response = await fetchWithAccountKey(url, { method: "GET" });
  const data = await responseHandler(response);
  return {
    ...data.response,
    destination_uri: getExportUri(data.response), // eslint-disable-line camelcase
  };
}

/**
 * The account API module with the currently supported endpoints.
 */
const accountAPI = {
  listDatabases,
  createKey,
  refreshSession,
  getSession,
  createExport,
  listExports,
  getExport,
};

export default accountAPI;

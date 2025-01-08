//@ts-check

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

let accountUrl = process.env.FAUNA_ACCOUNT_URL ?? "https://account.fauna.com";

export function getAccountUrl() {
  return accountUrl;
}

export function setAccountUrl(url) {
  accountUrl = url;
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
    url.searchParams.set(key, value);
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

export async function responseHandler(response) {
  if (!response.ok) {
    await accountToCommandError(response);
  }

  return await response.json();
}

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
 * @throws {Error} - Throws an error if there is an issue during key creation.
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

const accountAPI = {
  listDatabases,
  createKey,
  refreshSession,
  getSession,
};

export default accountAPI;

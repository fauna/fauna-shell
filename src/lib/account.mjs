import { container } from "../cli.mjs";
import {
  CommandError,
  InvalidCredsError,
  UnauthorizedError,
} from "./errors.mjs";

/**
 * Error class for errors from the account API
 *
 * @param {string} message - The message of the error
 * @param {Object} opts
 * @param {string} [opts.cause] - The cause of the error
 * @param {string} [opts.code] - The code of the error
 * @param {string} [opts.reason] - The reason of the error
 */
export class AccountError extends Error {
  constructor(message, { cause, code, reason }) {
    super(message);
    this.name = "AccountError";
    this.cause = cause;
    this.code = code;
    this.reason = reason;
  }
}

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

  function _getHeaders() {
    const headers = {
      "content-type": contentType,
    };
    if (secret) {
      headers.Authorization = `Bearer ${secret}`;
    }
    return headers;
  }

  const fetchArgs = {
    method,
    headers: _getHeaders(),
    redirect: "manual",
  };

  if (body) fetchArgs.body = body;

  const response = await fetch(fullUrl, fetchArgs);

  return parseResponse(response, shouldThrow);
}

async function handleError(response, responseIsJSON) {
  let code, reason;
  let message = `Failed to make request to Fauna account API [${response.status}]`;

  if (responseIsJSON) {
    const body = await response.json();
    ({ reason, code } = body);
    message += `: ${code} - ${reason}`;
  }

  // These error codes should be displayed to the user as a command error
  if (code === "invalid_input" || code === "does_not_exist") {
    throw new CommandError(reason ?? message);
  } else if (response.status === 401) {
    throw new InvalidCredsError(message);
  } else if (response.status === 403) {
    throw new UnauthorizedError(message);
  } else {
    // Bundle everything else as an account error that commands can handle as needed.
    throw new AccountError(message, { code, reason });
  }
}

async function parseResponse(response, shouldThrow) {
  const responseType =
    response?.headers?.get("content-type") || "application/json";
  const responseIsJSON = responseType.includes("application/json");

  if (response.status >= 400 && shouldThrow) {
    await handleError(response, responseIsJSON);
  }

  return responseIsJSON ? await response.json() : await response;
}

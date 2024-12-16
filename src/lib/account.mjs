import { container } from "../cli.mjs";
import {
  AuthenticationError,
  AuthorizationError,
  CommandError,
} from "./errors.mjs";
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

/**
 * Throws an error based on the status code of the response
 *
 * @param {Response} response
 * @param {boolean} responseIsJSON
 * @throws {AuthenticationError | AuthorizationError | CommandError | Error}
 */
const accountToCommandError = async (response, responseIsJSON) => {
  let message = `Failed to make request to Fauna account API [${response.status}]`;

  let { code, reason, body } = {};
  if (responseIsJSON) {
    body = await response.json();
    ({ reason, code } = body);
    message += `: ${code} - ${reason}`;
  }

  // If consumers want to do more with this, they analyze the cause
  const responseAsCause = new Error(message);
  responseAsCause.status = response.status;
  responseAsCause.body = body;
  responseAsCause.headers = response.headers;
  responseAsCause.code = code;
  responseAsCause.reason = reason;

  switch (response.status) {
    case 401:
      throw new AuthenticationError({ cause: responseAsCause });
    case 403:
      throw new AuthorizationError({ cause: responseAsCause });
    case 400:
    case 404:
      throw new CommandError(reason ?? message, {
        cause: responseAsCause,
        hideHelp: true,
      });
    default:
      throw new Error(message, { cause: responseAsCause });
  }
};

/**
 * Returns the proper result based on the content type of the account API response
 *   Conditionally throws errors for status codes > 400
 *
 * @param {Response} response result of the fetch call to account api
 * @param {boolean} shouldThrow whether to ignore an error from the result
 * @returns {Promise<Response | Object>} - The response from the request
 * @throws {AuthenticationError | AuthorizationError | CommandError | Error}
 */
export async function parseResponse(response, shouldThrow) {
  const responseType =
    response?.headers?.get("content-type") || "application/json";
  const responseIsJSON = responseType.includes("application/json");

  if (response.status >= 400 && shouldThrow) {
    await accountToCommandError(response, responseIsJSON);
  }

  const result = responseIsJSON ? await response.json() : await response;
  return result;
}

//@ts-check

import { container } from "../config/container.mjs";
import {
  AuthenticationError,
  CommandError,
  NETWORK_ERROR_MESSAGE,
} from "./errors.mjs";
import { retryInvalidCredsOnce } from "./fauna-client.mjs";

function buildParamsString({ argv, params, path }) {
  const routesWithColor = ["/schema/1/staged/status", "/schema/1/diff"];
  if (params && argv.color && routesWithColor.includes(path))
    params.set("color", "ansi");
  if (params && params.sort) params.sort();
  const paramsString = params && params.size ? `?${params.toString()}` : "";
  return paramsString;
}

/**
 * @typedef {('GET'|'HEAD'|'OPTIONS'|'PATCH'|'PUT'|'POST'|'DELETE'|'PATCH')} method
 */

/**
 * @typedef {Object} fetchParameters
 * @property {Object} argv - The parsed argv from yargs; used to find the base url (`argv.url`), secret (`argv.secret`), and color support (`argv.color`). To overwrite, provided a modified argv to `makeFaunaRequest`.
 * @property {string} path - The path part of the URL. Added to the baseUrl and params to build the full URL.
 * @property {URLSearchParams|undefined} [params] - The parameters (and their values) to set in the query string.
 * @property {method} method - The HTTP method to use when making the request.
 * @property {object} [body] - The body to include in the request.
 * @property {boolean} [shouldThrow=true] - Whether or not to throw if the network request succeeds but is not a 2XX. If this is set to false, makeFaunaRequest will return the error instead of throwing.
 * @property {string} [secret] - The secret to use when making the request.
 */

/**
 * @param {fetchParameters} args
 */
// eslint-disable-next-line complexity
export async function makeFaunaRequest({
  argv,
  path,
  params = undefined,
  method,
  body = undefined,
  shouldThrow = true,
  secret,
}) {
  const fetch = container.resolve("fetch");
  const paramsString = buildParamsString({ argv, params, path });
  let fullUrl;

  try {
    fullUrl = new URL(`${path}${paramsString}`, argv.url).href;
  } catch (e) {
    e.message = `Could not build valid URL out of base url (${argv.url}), path (${path}), and params string (${paramsString}) built from params (${JSON.stringify(
      params,
    )}).`;
    throw e;
  }

  const fetchArgs = {
    method,
    headers: { AUTHORIZATION: `Bearer ${secret}` },
  };

  if (body) fetchArgs.body = body;

  let response;
  try {
    response = await fetch(fullUrl, fetchArgs);
  } catch (err) {
    if (err.name === "TypeError" && err.message.includes("fetch failed")) {
      throw new CommandError(NETWORK_ERROR_MESSAGE);
    }

    throw err;
  }

  const obj = await response.json();

  if (obj.error && shouldThrow) {
    if (obj.error.code === "unauthorized") {
      throw new AuthenticationError({ cause: obj.error });
    }

    const err = new CommandError(obj.error.message, { cause: obj.error });
    err.name = obj.error.code;
    throw err;
  }

  return obj;
}

/**
 * @param {fetchParameters} opts
 * @returns {Promise<Object>}
 */
export function makeRetryableFaunaRequest(opts) {
  return retryInvalidCredsOnce(opts.secret, (secret) =>
    makeFaunaRequest({ ...opts, secret }),
  );
}

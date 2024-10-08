//@ts-check

import { container } from "../cli.mjs";

/**
 * @function makeFaunaRequest
 * @param {object} args
 * @param {string} args.secret - The secret to include in the AUTHORIZATION header of the request.
 * @param {string} args.baseUrl - The base URL from the scheme up through the top level domain and optional port; defaults to "https://db.fauna.com:443".
 * @param {string} args.path - The path part of the URL. Added to the baseUrl and params to build the full URL.
 * @param {Record<string, string>} [args.params] - The parameters (and their values) to set in the query string.
 * @param {('GET'|'HEAD'|'OPTIONS'|'PATCH'|'PUT'|'POST'|'DELETE'|'PATCH')} args.method - The HTTP method to use when making the request.
 * @param {object} [args.body] - The body to include in the request.
 * @param {boolean} [args.shouldThrow] - Whether or not to throw if the network request succeeds but is not a 2XX. If this is set to false, makeFaunaRequest will return the error instead of throwing.
 */
export async function makeFaunaRequest({
  secret,
  baseUrl,
  path,
  params = undefined,
  method,
  body = undefined,
  shouldThrow = true,
}) {
  const fetch = container.resolve("fetch");
  const paramsString = params ? `?${new URLSearchParams(params)}` : "";
  let fullUrl;

  try {
    fullUrl = new URL(`${path}${paramsString}`, baseUrl).href;
  } catch (e) {
    e.message = `Could not build valid URL out of base url (${baseUrl}), path (${path}), and params string (${paramsString}) built from params (${JSON.stringify(
      params
    )}).`;
    throw e;
  }

  const fetchArgs = {
    method,
    headers: { AUTHORIZATION: `Bearer ${secret}` },
  };

  if (body) fetchArgs.body = body;

  const response = await fetch(fullUrl, fetchArgs);

  const obj = await response.json();

  if (obj.error && shouldThrow) {
    throw new Error(obj.error.message);
  }

  return obj;
}
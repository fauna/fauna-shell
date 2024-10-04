import { container } from "../cli.mjs";

export async function makeFaunaRequest({
  secret,
  baseUrl,
  path,
  params,
  method,
  body,
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

import { join } from "node:path";

// small helper for sinon to wrap your return value
// in the shape fetch would return it from the network
export function f(returnValue, status) {
  return { json: async () => returnValue, status: status || 200 };
}

export const commonFetchParams = {
  method: "GET",
  headers: {
    AUTHORIZATION: "Bearer secret",
  },
};

/**
 * this method sorts the query parameters - since makeFaunaRequest does as well,
 * this allows comparing the resulting string URLs without false negatives
 * from different sorting strategies.
 *
 * @param {string} path - the path to build a URL for
 * @param {Record<string, string>} paramObject - the params to include in the querystring
 */
export function buildUrl(path, paramObject) {
  const params = new URLSearchParams(paramObject);
  params.sort();
  let result = "db.fauna.com";
  if (path) result = join(result, path);
  if (params.size) result = `${result}?${params}`;
  return `https://${result}`;
}

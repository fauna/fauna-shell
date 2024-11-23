//@ts-check

import { Client } from "fauna";

/**
 * @type {import("fauna").QueryOptions}
 */
export const defaultV10QueryOptions = {
  format: "simple",
  typecheck: false,
};

/**
 * Creates a V10 Fauna client.
 *
 * @param {object} opts
 * @param {string} opts.url
 * @param {string} opts.secret
 * @returns {Promise<Client>}
 */
export const getV10Client = async ({ url, secret }) => {
  // Check for required arguments.
  if (!url || !secret) {
    throw new Error("A url and secret are required.");
  }
  // Create the client.
  return new Client({ secret, endpoint: new URL(url) });
};

/**
 * Runs a V10 Fauna query. A client may be provided, or a url
 * and secret may be used to create one.
 *
 * @param {object} opts
 * @param {import("fauna").Query<any>} opts.query
 * @param {string} [opts.url]
 * @param {string} [opts.secret]
 * @param {Client} [opts.client]
 * @param {object} [opts.options]
 * @returns {Promise<import("fauna").QuerySuccess<any>>}
 */
export const runV10Query = async ({
  query,
  url,
  secret,
  client,
  options = {},
}) => {
  // Check for required arguments.
  if (!query) {
    throw new Error("A query is required.");
  } else if (!client && (!url || !secret)) {
    throw new Error("A client or url and secret are required.");
  }

  // Create the client if one wasn't provided.
  let _client =
    client ??
    (await getV10Client({
      url: /** @type {string} */ (url), // We know this is a string because we check for !url above.
      secret: /** @type {string} */ (secret), // We know this is a string because we check for !secret above.
    }));

  // Run the query.
  return _client
    .query(query, { ...defaultV10QueryOptions, ...options })
    .finally(() => {
      // Clean up the client if one was created internally.
      if (!client && _client) _client.close();
    });
};

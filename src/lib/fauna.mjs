export const getV10Client = async ({ url, secret }) => {
  const { Client } = (await import("fauna")).default;
  return new Client({
    secret,
    endpoint: url,
  });
};

export const runV10Query = async ({
  query,
  url = undefined,
  secret = undefined,
  client = undefined,
  options = {
    format: "simple",
    typecheck: false,
  },
}) => {
  let _client = client;

  if (!_client && url && secret) {
    _client = await getV10Client({ url, secret });
  } else if (!_client) {
    throw new Error("No client provided and no url and secret provided");
  }

  return _client.query(query, options).finally(() => {
    // Clean up the client if one was created internally.
    if (!client) _client.close();
  });
};

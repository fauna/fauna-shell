const url = require("url");
const { query: q } = require("faunadb");
const env = process.env;

/**
 * Sets --domain, --secret, --scheme, and --port.
 */
module.exports.withLegacyOpts = (cmd) => {
  const opts = [
    "--secret",
    env.FAUNA_SECRET,
    "--domain",
    env.FAUNA_DOMAIN,
    "--scheme",
    env.FAUNA_SCHEME,
    "--port",
    env.FAUNA_PORT,
  ];
  return cmd.concat(opts);
};

/**
 * Sets --secret and --url
 */
module.exports.withOpts = (cmd) => {
  const opts = [
    "--secret",
    env.FAUNA_SECRET,
    "--url",
    `${env.FAUNA_SCHEME}://${env.FAUNA_DOMAIN}:${env.FAUNA_PORT}`,
  ];
  return cmd.concat(opts);
};

const getEndpoint = () =>
  url.format({
    protocol: env.FAUNA_SCHEME,
    hostname: env.FAUNA_DOMAIN,
    port: env.FAUNA_PORT,
  });

module.exports.getEndpoint = getEndpoint;

module.exports.evalV10 = (query) => {
  const endpoint = getEndpoint();
  const secret = env.FAUNA_SECRET;
  const Readable = require("stream").Readable;
  const stream = new Readable();
  stream.push(JSON.stringify({ query }));
  stream.push(null);
  return fetch(new URL("/query/1", endpoint), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
    },
    body: stream,
  });
};

const fqlToJsonString = (fql) => JSON.stringify(q.wrap(fql));
module.exports.fqlToJsonString = fqlToJsonString;

module.exports.matchFqlReq = (fql) => (req) => {
  return JSON.stringify(req)
    .replace(/\\"/g, '"')
    .includes(fqlToJsonString(fql));
};

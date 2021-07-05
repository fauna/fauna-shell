const url = require('url')
const { query: q } = require('faunadb')
const env = process.env

module.exports.withOpts = (cmd) => {
  const opts = [
    '--secret',
    env.FAUNA_SECRET,
    '--domain',
    env.FAUNA_DOMAIN,
    '--scheme',
    env.FAUNA_SCHEME,
    '--port',
    env.FAUNA_PORT,
  ]
  return cmd.concat(opts)
}

module.exports.getEndpoint = () =>
  url.format({
    protocol: env.FAUNA_SCHEME,
    hostname: env.FAUNA_DOMAIN,
    port: env.FAUNA_PORT,
  })

const fqlToJsonString = (fql) => JSON.stringify(q.wrap(fql))
module.exports.fqlToJsonString = fqlToJsonString

module.exports.matchFqlReq = (fql) => (req) =>
  JSON.stringify(req).replace(/\\"/g, '"').includes(fqlToJsonString(fql))

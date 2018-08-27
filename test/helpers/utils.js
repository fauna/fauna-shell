const env = process.env

function withOpts(cmd) {
  const opts = [
    '--secret', env.FAUNA_SECRET,
    '--domain', env.FAUNA_DOMAIN,
    '--scheme', env.FAUNA_SCHEME,
    '--port',   env.FAUNA_PORT,
  ]
  return cmd.concat(opts)
}

module.exports = {
  withOpts: withOpts,
}

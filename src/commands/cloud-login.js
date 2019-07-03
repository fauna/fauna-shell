const {cli} = require('cli-ux')
const {flags} = require('@oclif/command')
const {validCloudEndpoint, saveEndpointOrError, errorOut} = require('../lib/misc.js')
const FaunaCommand = require('../lib/fauna-command.js')
const os = require('os')
const rp = require('request-promise')
const url = require('url')
const http = require('http')
const crypto = require('crypto')
const childProcess = require('child_process')

const SHELL_LOGIN_URL = 'https://app.fauna.com/shell_login'
const GITHUB_HTTP_HANDLER_PORT = 8086
const GITHUB_CLIENT_ID = '615935a34846151ad806'
const alias = 'cloud'
const CLOUD_URL = 'https://db.fauna.com'
const newEndpoint = url.parse(CLOUD_URL)

class CloudLoginCommand extends FaunaCommand {
  async run() {
    const {flags} = this.parse(CloudLoginCommand)

    return validCloudEndpoint()
    .then(async function (_) {
      if (flags.github) {
        return githubStrategy(flags.no_browser)
      } else {
        return cloudStrategy()
      }
    })
    .catch(function (err) {
      errorOut(err.message, 1)
    })
  }
}

async function cloudStrategy() {
  const email = await cli.prompt('Email', {timeout: 120000})
  const password = await cli.prompt('Password', {type: 'hide', timeout: 120000})

  const formData = {
    email: email,
    password: password,
    session: 'Fauna Shell - ' + os.hostname(),
  }

  let options = {
    method: 'POST',
    uri: SHELL_LOGIN_URL,
    form: formData,
    resolveWithFullResponse: true,
  }

  return rp(options)
  .then(function (res) {
    const secret = JSON.parse(res.body).secret
    return saveEndpointOrError(newEndpoint, alias, secret)
  })
  .catch(function (err) {
    if (err.statusCode === 401) {
      errorOut(JSON.parse(err.error).message, 1)
    } else {
      throw err
    }
  })
}

function githubStrategy(launchBrowser) {
  const state = `fauna-shell:${crypto.randomBytes(20).toString('hex')}`
  const LOGIN_WITH_GITHUB_URL = url.format({
    protocol: 'https',
    hostname: 'github.com',
    pathname: '/login/oauth/authorize',
    query: {
      'scope': 'user:email',
      'client_id': GITHUB_CLIENT_ID,
      'state': state,
    },
  })

  let server = null

  const requestHandler = (req, res) => {
    let parsedUrl = url.parse(req.url, true) // true to get query as object
    let queryAsObject = parsedUrl.query
    if (queryAsObject.state && queryAsObject.secret) {
      if (queryAsObject.state !== state) {
        return res.end('Logins can only be initiated from fauna shell.')
      }
      res.setHeader('Access-Control-Allow-Origin', '*')
      const secret = queryAsObject.secret

      saveEndpointOrError(newEndpoint, alias, secret).then(function (_) {
        const msg = `Endpoint '${alias}' saved.`
        cli.log(msg)
        res.end(msg)
        server.close(err => process.exit())
      })
      .catch(function (err) {
        res.end('Endpoint not saved')
        errorOut(JSON.parse(err.error).message, 1)
        process.exit(1)
      })
    } else {
      res.end('fauna-shell')
    }
  }

  server = http.createServer(requestHandler)

  return server.listen(GITHUB_HTTP_HANDLER_PORT, err => {
    if (err) {
      return console.log('something bad happened', err)
    }

    console.log(`Local handler is listening on ${GITHUB_HTTP_HANDLER_PORT}`)
    if (launchBrowser) {
      cli.info(`Copy and open link in browser: ${LOGIN_WITH_GITHUB_URL}`)
    } else {
      cli.info(`Launching browser... ${LOGIN_WITH_GITHUB_URL}`)
      let start = (process.platform == 'darwin' ? 'open' : process.platform == 'win32' ? 'start' : 'xdg-open')
      childProcess.exec(`${start} "${LOGIN_WITH_GITHUB_URL}"`)
    }
  })
}

CloudLoginCommand.description = `
Adds the FaunaDB Cloud endpoint
`

CloudLoginCommand.examples = [
  '$ fauna cloud-login',
  '$ fauna cloud-login --github',
  '$ fauna cloud-login --github --no_browser',
]

// clear the default FaunaCommand flags that accept --host, --port, etc.
CloudLoginCommand.flags = {
  'github': flags.boolean({
    description: 'Login to Fauna shell using your Github account.',
    required: false,
    default: false,
  }),
  'no_browser': flags.boolean({
    description: 'Do not launch the default browser',
    required: false,
    default: false,
  }),
}

CloudLoginCommand.args = [
]

module.exports = CloudLoginCommand

const {cli} = require('cli-ux')
const {validCloudEndpoint, saveEndpointOrError, errorOut} = require('../lib/misc.js')
const FaunaCommand = require('../lib/fauna-command.js')
const os = require('os')
var rp = require('request-promise')
const url = require('url')

class CloudLoginCommand extends FaunaCommand {
  async run() {
    return validCloudEndpoint()
    .then(async function (_) {
      const SHELL_LOGIN_URL = 'https://app.fauna.com/shell_login'
      const CLOUD_URL = 'https://db.fauna.com'
      const email = await cli.prompt('Email', {timeout: 120000})
      const password = await cli.prompt('Password', {type: 'hide', timeout: 120000})
      const newEndpoint = url.parse(CLOUD_URL)
      const alias = 'cloud'

      const formData = {
        email: email,
        password: password,
        session: 'Fauna Shell - ' + os.hostname(),
      }

      var options = {
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
    })
    .catch(function (err) {
      errorOut(err.message, 1)
    })
  }
}

CloudLoginCommand.description = `
Adds the FaunaDB Cloud endpoint
`

CloudLoginCommand.examples = [
  '$ fauna cloud-login',
]

// clear the default FaunaCommand flags that accept --host, --port, etc.
CloudLoginCommand.flags = {
}

CloudLoginCommand.args = [
]

module.exports = CloudLoginCommand

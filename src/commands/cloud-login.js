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
        return cloudStrategy()
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

CloudLoginCommand.description = `
Adds the FaunaDB Cloud endpoint
`

CloudLoginCommand.examples = [
  '$ fauna cloud-login',
]

CloudLoginCommand.args = [
]

module.exports = CloudLoginCommand

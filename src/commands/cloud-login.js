const { cli } = require('cli-ux')
const {
  validCloudEndpoint,
  saveEndpointOrError,
  errorOut,
} = require('../lib/misc.js')
const FaunaCommand = require('../lib/fauna-command.js')
const os = require('os')
const fetch = require('request-promise')
const url = require('url')
require('dotenv').config()

const SHELL_LOGIN_URL = process.env.FAUNA_SHELL_LOGIN_URL
  ? process.env.FAUNA_SHELL_LOGIN_URL
  : 'https://auth.console.fauna.com/login'
const alias = 'cloud'
const CLOUD_URL = 'https://db.fauna.com'
const newEndpoint = url.parse(CLOUD_URL)
const EMAIL_STRATEGY = 'email'
const SECRET_STRATEGY = 'secret'
const strategies = {
  [EMAIL_STRATEGY]: emailStrategy,
  [SECRET_STRATEGY]: secretStrategy,
}
const OTP_REQUIRED = 'otp_required'

class CloudLoginCommand extends FaunaCommand {
  async run() {
    return validCloudEndpoint()
      .then(() => cloudStrategy({ log: this.log }))
      .catch(function (err) {
        errorOut(err.message, 1)
      })
  }
}

async function cloudStrategy({ log }) {
  log('For email login, enter your email below, and then your password.')
  log(
    'For login with 3rd-party identity providers like Github or Netlify, please acquire a key from Home > [database] > Security and enter it below instead.'
  )
  log('')

  const credential = await cli.prompt('Email or secret key')
  const strategy =
    strategies[isEmail(credential) ? EMAIL_STRATEGY : SECRET_STRATEGY]

  strategy(credential).catch(function (err) {
    if (err.statusCode === 401) {
      errorOut(JSON.parse(err.error).message, 1)
    } else {
      throw err
    }
  })
}

function secretStrategy(secret) {
  return saveEndpointOrError(newEndpoint, alias, secret)
}

async function emailStrategy(email) {
  const password = await cli.prompt('Password', {
    type: 'hide',
    timeout: 120000,
  })

  const formData = {
    email: email,
    password: password,
    session: 'Fauna Shell - ' + os.hostname(),
  }

  return fetch({
    method: 'POST',
    uri: SHELL_LOGIN_URL,
    form: formData,
    resolveWithFullResponse: true,
  })
    .then(function (res) {
      const secret = JSON.parse(res.body).secret
      return saveEndpointOrError(newEndpoint, alias, secret)
    })
    .catch(async function (error) {
      if (
        !error.statusCode ||
        !error.error ||
        JSON.parse(error.error).code !== OTP_REQUIRED
      )
        throw error

      return multiFactorVerification(formData)
    })
}

async function multiFactorVerification(formData) {
  // Prompt the user for their OTP code
  const otpCode = await cli.prompt(
    'Enter your multi-factor authentication code',
    {
      type: 'hide',
      timeout: 120000,
    }
  )

  // Make another request with the OTP code included
  return fetch({
    method: 'POST',
    uri: SHELL_LOGIN_URL,
    form: {
      ...formData,
      otp: otpCode,
    },
    resolveWithFullResponse: true,
  }).then(function (res) {
    const secret = JSON.parse(res.body).secret
    return saveEndpointOrError(newEndpoint, alias, secret)
  })
}

function isEmail(string) {
  return /\S+@\S+\.\S+/.test(string)
}

CloudLoginCommand.description = `
Adds the FaunaDB Cloud endpoint
`

CloudLoginCommand.examples = ['$ fauna cloud-login']

CloudLoginCommand.flags = {
  ...FaunaCommand.flags,
}

module.exports = CloudLoginCommand

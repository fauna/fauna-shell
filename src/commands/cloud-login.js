const FaunaCommand = require('../lib/fauna-command.js')
const inquirer = require('inquirer')
const request = require('request-promise')
const faunadb = require('faunadb')
const url = require('url')
const os = require('os')
const {
  loadEndpoints,
  saveEndpoint,
  setDefaultEndpoint,
} = require('../lib/misc.js')

class CloudLoginCommand extends FaunaCommand {
  async run() {
    this.config = await loadEndpoints()

    await this.aksEnvironment()
    await this.askAlias()
    await this.askAuth()

    const secrets = await this[`${this.auth}Strategy`]()

    const endpoints = await Promise.all(
      Object.entries(secrets).map(([region, secret]) =>
        this.saveEndpoint({ region, secret })
      )
    )

    await this.askIsDefault(endpoints)
  }

  async saveEndpoint({ region, secret }) {
    const newEndpoint = url.parse(
      this.maybeDomainWithRegion(this.environment.db, region)
    )
    newEndpoint.graphql = url.parse(
      this.maybeDomainWithRegion(this.environment.graphql, region)
    )

    const alias = region === 'global' ? this.alias : `${this.alias}-${region}`
    await saveEndpoint(this.config, newEndpoint, alias, secret)
    return alias
  }

  aksEnvironment() {
    return inquirer
      .prompt([
        {
          name: 'environment',
          message: 'Select an environment:',
          type: 'list',
          choices: [
            {
              name: 'Production',
              value: {
                defaultAlias: 'cloud',
                db: 'https://db.fauna.com',
                auth: 'https://auth.console.fauna.com/login',
                graphql: 'https://graphql.fauna.com',
              },
            },
            {
              name: 'Preview',
              value: {
                defaultAlias: 'preview',
                db: 'https://db.fauna-preview.com',
                auth: 'https://auth-console.fauna-preview.com/login',
                graphql: 'https://graphql.fauna-preview.com',
              },
            },
          ],
        },
      ])
      .then(({ environment }) => {
        this.environment = environment
      })
  }

  askAlias() {
    return inquirer
      .prompt([
        {
          name: 'alias',
          message: 'The endpoint alias prefix (to combine with a region):',
          type: 'input',
          default: this.environment.defaultAlias,

          validate: (endpoint) =>
            endpoint ? true : 'Provide an endpoint alias.',
        },
        {
          name: 'overwrite',
          message: 'The endpoint alias already exists. Overwrite?',
          type: 'confirm',
          when: ({ alias }) => Boolean(this.config[alias]),
        },
      ])
      .then((resp) => {
        if (resp.hasOwnProperty('overwrite') && !resp.overwrite) {
          this.askAlias()
        } else {
          this.alias = resp.alias
        }
      })
  }

  askAuth() {
    return inquirer
      .prompt([
        {
          name: 'auth',
          message: 'How do you prefer to authenticate?',
          type: 'list',
          choices: [
            { name: 'Email and Password', value: 'password' },
            { name: 'Secret', value: 'secret' },
            // { name: 'GitHub', value: 'github' },
            // { name: 'Netlify', value: 'netlify' },
          ],
        },
      ])
      .then(({ auth }) => {
        this.auth = auth
      })
  }

  async askIsDefault(endpoints) {
    if (!this.config.default && endpoints.length === 1) {
      await setDefaultEndpoint(endpoints[0])
      return this.log(`Endpoint '${endpoints[0]}' added as default`)
    }

    if (this.config.default === endpoints[0] && endpoints.length === 1) {
      return this.log(`Endpoint '${endpoints[0]}' added.`)
    }

    // If 1 new endpoint which is not a default one (and default exists), ask a user to consider it as default
    // If more than 1 endpoints, ask which one a user would like to be a default (or keep existing)

    const { defaultEndpoint } = await inquirer.prompt([
      {
        name: 'setDefault',
        message: `Would you like endpoint '${endpoints[0]}' to be default?`,
        type: 'confirm',
        when: endpoints.length === 1,
      },
      {
        name: 'defaultEndpoint',
        message:
          'Endpoints created. Would you like to set one of them as default?',
        type: 'list',
        when: endpoints.length > 1,
        choices: [
          { name: `Keep '${this.config.default}' endpoint as default` },
          ...endpoints
            .filter((e) => e !== this.config.default)
            .map((e) => ({ name: e, value: e })),
        ],
      },
    ])

    if (defaultEndpoint) {
      return setDefaultEndpoint(defaultEndpoint)
        .then(this.log)
        .catch(this.error)
    }
  }

  async secretStrategy() {
    const data = await inquirer.prompt([
      {
        name: 'secret',
        message: 'Secret',
        type: 'input',
      },
      {
        name: 'region',
        message: 'Select a region',
        type: 'list',
        choices: [
          { name: 'Classic', value: 'global' },
          { name: 'Europe (EU)', value: 'eu' },
          { name: 'United States (US)', value: 'us' },
        ],
      },
    ])

    const dbUrl = this.maybeDomainWithRegion(this.environment.db, data.region)
    const client = new faunadb.Client({
      secret: data.secret,
      domain: url.parse(dbUrl).hostname,
    })

    try {
      await client.query(faunadb.query.Now())
      return { [data.region]: data.secret }
    } catch (err) {
      if (err instanceof faunadb.errors.Unauthorized) {
        this.warn(`Could not Connect to ${dbUrl} Unauthorized Secret`)
        return this.secretStrategy()
      }

      throw err
    }
  }

  async passwordStrategy() {
    this.credentials = await inquirer.prompt([
      {
        name: 'email',
        message: 'Email address:',
        type: 'input',
        validate: (email) => {
          return !email || !/\S+@\S+\.\S+/.test(email)
            ? 'Provide a valid email address.'
            : true
        },
      },
      {
        name: 'password',
        message: 'Password:',
        type: 'password',
      },
    ])

    return this.loginByPassword()
  }

  async otp() {
    const { otp } = await inquirer.prompt([
      {
        name: 'otp',
        message: 'Enter your multi-factor authentication code',
        type: 'input',
      },
    ])

    return this.loginByPassword({
      otp,
    })
  }

  handlePasswordStrategyError({ error }) {
    if (!error.error) throw error
    const errorResp = JSON.parse(error.error)

    if (['otp_required', 'otp_invalid'].includes(errorResp.code)) {
      if (errorResp.code === 'otp_invalid') this.warn(errorResp.message)
      return this.otp()
    }

    if (errorResp.code === 'invalid_credentials') {
      this.warn(errorResp.message)
      return this.passwordStrategy()
    }

    throw error
  }

  loginByPassword({ otp } = {}) {
    return request({
      method: 'POST',
      uri: this.environment.auth,
      form: {
        ...this.credentials,
        session: 'Fauna Shell - ' + os.hostname(),
        ...(otp && { otp }),
      },
      resolveWithFullResponse: true,
    })
      .then((resp) => {
        const data = JSON.parse(resp.body)
        return {
          global: data.secret || data.regionGroups.global.secret,
          eu: data.regionGroups.eu.secret,
          us: data.regionGroups.us.secret,
        }
      })
      .catch((error) => this.handlePasswordStrategyError({ error }))
  }

  maybeDomainWithRegion(domain, region) {
    return region && region !== 'global'
      ? domain
          .replace('db.', `db.${region}.`)
          .replace('graphql.', `graphql.${region}.`)
      : domain
  }
}

CloudLoginCommand.description = 'Adds the FaunaDB Cloud endpoint'
CloudLoginCommand.examples = ['$ fauna cloud-login']

module.exports = CloudLoginCommand

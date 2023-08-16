const FaunaCommand = require("../lib/fauna-command.js");
const inquirer = require("inquirer");
const fetch = require("node-fetch");
const faunadb = require("faunadb");
const url = require("url");
const os = require("os");
// const puppeteer = require('puppeteer')
// const querystring = require('querystring')
const {
  loadEndpoints,
  saveEndpoint,
  setDefaultEndpoint,
} = require("../lib/misc.js");

class CloudLoginCommand extends FaunaCommand {
  async run() {
    this.config = await loadEndpoints();

    // await this.aksEnvironment()
    this.environment = {
      defaultAlias: "cloud",
      db: "https://db.fauna.com",
      auth: "https://auth.console.fauna.com",
      graphql: "https://graphql.fauna.com",
      dashboard: "https://dashboard.fauna.com",
    };
    await this.askAlias();

    const secrets = await this.askAuthAndGetSecret();

    const endpoints = await Promise.all(
      Object.entries(secrets).map(([region, secret]) =>
        this.saveEndpoint({ region, secret })
      )
    );

    await this.askIsDefault(endpoints);
  }

  async askAuthAndGetSecret() {
    const reAskErrorMessages = [
      "Target closed",
      "Navigation failed because browser has disconnected!",
    ];
    try {
      await this.askAuth();
      const secrets = await this[`${this.auth}Strategy`]();
      return secrets;
    } catch (err) {
      if (reAskErrorMessages.includes(err.message)) {
        return this.askAuthAndGetSecret();
      }

      throw err;
    }
  }

  async saveEndpoint({ region, secret }) {
    const newEndpoint = url.parse(
      this.maybeDomainWithRegion(this.environment.db, region)
    );
    newEndpoint.graphql = url.parse(
      this.maybeDomainWithRegion(this.environment.graphql, region)
    );

    const alias = region === "global" ? this.alias : `${this.alias}-${region}`;
    await saveEndpoint(this.config, newEndpoint, alias, secret);
    return alias;
  }

  aksEnvironment() {
    return inquirer
      .prompt([
        {
          name: "environment",
          message: "Select an environment:",
          type: "list",
          choices: [
            {
              name: "Production",
              value: {
                defaultAlias: "cloud",
                db: "https://db.fauna.com",
                auth: "https://auth.console.fauna.com",
                graphql: "https://graphql.fauna.com",
                dashboard: "https://dashboard.fauna.com",
              },
            },
            {
              name: "Preview",
              value: {
                defaultAlias: "preview",
                db: "https://db.fauna-preview.com",
                auth: "https://auth-console.fauna-preview.com",
                graphql: "https://graphql.fauna-preview.com",
                dashboard: "https://dashboard.fauna-preview.com",
              },
            },
          ],
        },
      ])
      .then(({ environment }) => {
        this.environment = environment;
      });
  }

  askAlias() {
    return inquirer
      .prompt([
        {
          name: "alias",
          message: "The endpoint alias prefix (to combine with a region):",
          type: "input",
          default: this.environment.defaultAlias,

          validate: (endpoint) =>
            endpoint ? true : "Provide an endpoint alias.",
        },
        {
          name: "overwrite",
          message: "The endpoint alias already exists. Overwrite?",
          type: "confirm",
          when: ({ alias }) => Boolean(this.config[alias]),
        },
      ])
      .then((resp) => {
        if (resp.hasOwnProperty("overwrite") && !resp.overwrite) {
          return this.askAlias();
        } else {
          this.alias = resp.alias;
        }
      });
  }

  askAuth() {
    return inquirer
      .prompt([
        {
          name: "auth",
          message: "How do you prefer to authenticate?",
          type: "list",
          choices: [
            { name: "Email and Password", value: "password" },
            { name: "Secret", value: "secret" },
            // { name: 'GitHub', value: 'github' },
            // { name: 'Netlify', value: 'netlify' },
          ],
        },
      ])
      .then(({ auth }) => {
        this.auth = auth;
      });
  }

  async askIsDefault(endpoints) {
    if (!this.config.default && endpoints.length === 1) {
      await setDefaultEndpoint(endpoints[0]);
      return this.log(`Endpoint '${endpoints[0]}' added as default`);
    }

    if (this.config.default === endpoints[0] && endpoints.length === 1) {
      return this.log(`Endpoint '${endpoints[0]}' added.`);
    }

    // If 1 new endpoint which is not a default one (and default exists), ask a user to consider it as default
    // If more than 1 endpoints, ask which one a user would like to be a default (or keep existing)

    const { setDefault, defaultEndpoint } = await inquirer.prompt([
      {
        name: "setDefault",
        message: `Would you like endpoint '${endpoints[0]}' to be default?`,
        type: "confirm",
        when: endpoints.length === 1,
      },
      {
        name: "defaultEndpoint",
        message:
          "Endpoints created. Would you like to set one of them as default?",
        type: "list",
        when: endpoints.length > 1,
        choices: [
          {
            name: `Keep '${this.config.default}' endpoint as default`,
            value: this.config.default,
          },
          ...endpoints
            .filter((e) => e !== this.config.default)
            .map((e) => ({ name: e, value: e })),
        ],
      },
    ]);

    if (setDefault) {
      return setDefaultEndpoint(endpoints[0]).then(this.log).catch(this.error);
    }

    if (defaultEndpoint) {
      return setDefaultEndpoint(defaultEndpoint)
        .then(this.log)
        .catch(this.error);
    }
  }

  githubStrategy() {
    return this.oauthStrategy("github");
  }

  netlifyStrategy() {
    return this.oauthStrategy("netlify");
  }

  // async oauthStrategy(provider) {
  //   const authEndpoint = `${this.environment.auth}/oauth/start?provider_name=${provider}&redirect_url=${this.environment.dashboard}/auth/oauth/callback`

  //   const browser = await puppeteer.launch({
  //     headless: false,
  //     args: ['--window-size=800,700'],
  //   })
  //   const page = await browser.newPage()
  //   await page.goto(authEndpoint)

  //   const callbackResponse = await page.waitForResponse(
  //     (resp) =>
  //       resp.url().includes(`${this.environment.auth}/oauth/callback?code`),
  //     { timeout: 1000 * 60 * 5 } // 5 minutes
  //   )
  //   await browser.close()

  //   const { location } = callbackResponse.headers()
  //   const { query } = url.parse(location)
  //   const { credentials, error } = querystring.parse(query)
  //   if (error) {
  //     this.error(error)
  //   }

  //   const data = JSON.parse(Buffer.from(credentials, 'base64').toString())
  //   return {
  //     global: data.secret || data.regionGroups.global.secret,
  //     eu: data.regionGroups.eu.secret,
  //     us: data.regionGroups.us.secret,
  //   }
  // }

  async secretStrategy() {
    const data = await inquirer.prompt([
      {
        name: "secret",
        message: "Secret (from a key or token):",
        type: "input",
      },
      {
        name: "region",
        message: "Select a region",
        type: "list",
        choices: [
          { name: "Classic", value: "global" },
          { name: "Europe (EU)", value: "eu" },
          { name: "United States (US)", value: "us" },
        ],
      },
    ]);

    const dbUrl = this.maybeDomainWithRegion(this.environment.db, data.region);
    const client = new faunadb.Client({
      secret: data.secret,
      domain: url.parse(dbUrl).hostname,
      headers: {
        "X-Fauna-Source": "Fauna Shell",
      },
    });

    try {
      await client.query(faunadb.query.Now());
      return { [data.region]: data.secret };
    } catch (err) {
      if (err instanceof faunadb.errors.Unauthorized) {
        this.warn(`Could not Connect to ${dbUrl} Unauthorized Secret`);
        return this.secretStrategy();
      }

      throw err;
    }
  }

  async passwordStrategy() {
    this.credentials = await inquirer.prompt([
      {
        name: "email",
        message: "Email address:",
        type: "input",
        validate: (email) => {
          return !email || !/\S+@\S+\.\S+/.test(email)
            ? "Provide a valid email address."
            : true;
        },
      },
      {
        name: "password",
        message: "Password:",
        type: "password",
      },
    ]);

    return this.loginByPassword();
  }

  async otp() {
    const { otp } = await inquirer.prompt([
      {
        name: "otp",
        message: "Enter your multi-factor authentication code",
        type: "input",
      },
    ]);

    return this.loginByPassword({
      otp,
    });
  }

  handlePasswordStrategyError({ error }) {
    console.info(error);
    if (["otp_required", "otp_invalid"].includes(error.code)) {
      if (error.code === "otp_invalid") this.warn(error.message);
      return this.otp();
    }

    if (error.code === "invalid_credentials") {
      this.warn(error.message);
      return this.passwordStrategy();
    }

    throw error;
  }

  loginByPassword({ otp } = {}) {
    return fetch([this.environment.auth, "login"].join("/"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...this.credentials,
        session: "Fauna Shell - " + os.hostname(),
        ...(otp && { otp }),
      }),
    })
      .then(async (resp) => {
        if (resp.ok) {
          return resp.json();
        }

        throw await resp.json();
      })
      .then((data) => ({
        global: data.secret || data.regionGroups.global.secret,
        eu: data.regionGroups.eu.secret,
        us: data.regionGroups.us.secret,
      }))
      .catch((error) => this.handlePasswordStrategyError({ error }));
  }

  maybeDomainWithRegion(domain, region) {
    return region && region !== "global"
      ? domain
          .replace("db.", `db.${region}.`)
          .replace("graphql.", `graphql.${region}.`)
      : domain;
  }
}

CloudLoginCommand.description = "Adds a Fauna endpoint.";
CloudLoginCommand.examples = ["$ fauna cloud-login"];
CloudLoginCommand.flags = [];

module.exports = CloudLoginCommand;

import { input, confirm, password } from "@inquirer/prompts";
import { ShellConfig } from "../lib/config";
import { hostname } from "os";
import { Command } from "@oclif/core";
import { underline, blue } from "chalk";
import OAuthServer from "../lib/auth/oauth-client";

const DEFAULT_NAME = "cloud";
const AUTH = process.env.FAUNA_AUTH ?? "https://auth.console.fauna.com";

type Regions = {
  [key: string]: Region;
};

type AccessToken = {
  access_token: string;
  token_type: string;
  ttl: string;
  state: string;
};

class Region {
  name: string;
  secret: string;

  constructor(name: string, secret: string) {
    this.name = name;
    this.secret = secret;
  }

  endpointName(base: string) {
    return `${base}-${this.name}`;
  }
}

// const DASHBOARD_URL = "http://localhost:3005/login";

export default class LoginCommand extends Command {
  static description = "Log in to a Fauna account.";
  static examples = ["$ fauna login"];
  static flags = {};

  async run() {
    await this.execute();
  }

  async getSession(access_token: string) {
    const myHeaders = new Headers();
    myHeaders.append("Authorization", `Bearer ${access_token}`);

    const requestOptions = {
      method: "POST",
      headers: myHeaders,
    };

    const response = await fetch(
      "http://localhost:8000/api/v1/session",
      requestOptions
    );
    const session = await response.json();
    return session;
  }

  async execute() {
    await this.parse();

    // const { port } = await startOAuthClient();
    const oAuth = new OAuthServer();
    await oAuth.start();
    // TODO: from within our local server, do a GET to frontdoor and receive
    // the redirect url to the dashboard w/ ?request= then tell them to open that.
    const authUrl = (await fetch(oAuth.getRequestUrl())).url;
    this.log(`To login, press Enter or open your browser to:\n ${authUrl}`);
    const { default: open } = await import("open");
    open(authUrl);
    oAuth.server.on("auth_code_received", async () => {
      try {
        const token: AccessToken = await (await oAuth.getToken()).json();
        this.log("Authentication successful!");
        const { state, ttl, access_token, token_type } = token;
        if (state !== oAuth.state) {
          throw new Error("Error during login: invalid state.");
        }
        const session = await this.getSession(access_token);
        this.log("Session created:", session);
      } catch (err) {
        console.error(err);
      }
    });

    // const base = await this.askName(config);
    // const regions = await this.passwordStrategy();
    // const newDefault = await this.askDefault(config, base, regions);

    // for (const region of Object.values(regions)) {
    //   config.rootConfig.endpoints[region.endpointName(base)] = new Endpoint({
    //     url: DB,
    //     secret: Secret.parse(region.secret),
    //   });
    // }

    // config.rootConfig.defaultEndpoint = newDefault;
    // config.saveRootConfig();

    // this.log("Configuration updated.");
  }

  async askName(config: ShellConfig): Promise<string> {
    const name = await input({
      message: "Endpoint name",
      default: DEFAULT_NAME,
      validate: (endpoint: string) =>
        endpoint === "" ? "Provide an endpoint name." : true,
    });

    if (config.rootConfig.endpoints[name] !== undefined) {
      const confirmed = await confirm({
        message: `The endpoint ${name} already exists. Overwrite?`,
        default: false,
      });
      if (!confirmed) {
        return this.askName(config);
      }
    }

    return name;
  }

  async passwordStrategy(): Promise<Regions> {
    return this.loginByPassword({
      email: await input({
        message: `Email address (from ${underline(
          blue("https://dashboard.fauna.com/")
        )})`,
        validate: (email) => {
          return !email || !/\S+@\S+\.\S+/.test(email)
            ? "Provide a valid email address."
            : true;
        },
      }),
      password: await password({
        message: "Password",
        mask: true,
      }),
    });
  }

  async otp({
    email,
    password,
  }: {
    email: string;
    password: string;
  }): Promise<Regions> {
    const otp = await input({
      message: "Enter your multi-factor authentication code",
    });

    return this.loginByPassword({
      email,
      password,
      otp,
    });
  }

  async handlePasswordStrategyError({
    email,
    password,
    error,
  }: {
    email: string;
    password: string;
    error: any;
  }): Promise<Regions> {
    if (["otp_required", "otp_invalid"].includes(error.code)) {
      if (error.code === "otp_invalid") {
        this.log(error.message);
      }
      return this.otp({ email, password });
    }

    if (error.code === "invalid_credentials") {
      this.log(error.message);
      return this.passwordStrategy();
    }

    throw error;
  }

  async loginByPassword({
    email,
    password,
    otp,
  }: {
    email: string;
    password: string;
    otp?: string;
  }): Promise<Regions> {
    const resp = await fetch(new URL("login", AUTH), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        type: "shell",
        session: "Fauna Shell - " + hostname(),
        ...(otp && { otp }),
      }),
    });
    const json = await resp.json();
    if (resp.ok) {
      return Object.fromEntries(
        Object.entries(json.regionGroups).map(([key, v]) => [
          key,
          new Region(key, (v as any).secret),
        ])
      );
    } else {
      return this.handlePasswordStrategyError({ email, password, error: json });
    }
  }
}

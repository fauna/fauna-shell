import { input, select, confirm, password } from "@inquirer/prompts";
import { Endpoint, ShellConfig } from "../lib/config";
import { hostname } from "os";
import { Command } from "@oclif/core";
import { underline, blue } from "chalk";
import fetch from "node-fetch";

const DEFAULT_NAME = "cloud";
const DB = process.env.FAUNA_URL ?? "https://db.fauna.com";
const AUTH = process.env.FAUNA_AUTH ?? "https://auth.console.fauna.com";

type Regions = {
  [key: string]: Region;
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

export default class CloudLoginCommand extends Command {
  static description = "Log in to a Fauna account.";
  static examples = ["$ fauna cloud-login"];
  static flags = {};

  async run() {
    const config = ShellConfig.read({});

    await this.execute(config);
  }

  async execute(config: ShellConfig) {
    await this.parse();

    const base = await this.askName(config);
    const regions = await this.passwordStrategy();
    const newDefault = await this.askDefault(config, base, regions);

    for (const region of Object.values(regions)) {
      config.rootConfig.endpoints[region.endpointName(base)] = new Endpoint({
        url: DB,
        secret: region.secret,
      });
    }

    config.rootConfig.defaultEndpoint = newDefault;
    config.saveRootConfig();

    this.log("Configuration updated.");
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

  async askDefault(
    config: ShellConfig,
    base: string,
    regions: Regions
  ): Promise<string> {
    return select({
      message:
        "Endpoints created. Which endpoint would you like to set as default?",
      choices: [
        ...(config.rootConfig.defaultEndpoint !== undefined
          ? [
              {
                name: `Keep '${config.rootConfig.defaultEndpoint}' endpoint as default`,
                value: config.rootConfig.defaultEndpoint,
              },
            ]
          : []),
        ...Object.values(regions).map((r) => ({ value: r.endpointName(base) })),
      ],
    });
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

import { Flags, Args, Command } from "@oclif/core";
import { input, confirm } from "@inquirer/prompts";
import { Endpoint, ShellConfig, getRootConfigPath } from "../lib/config";
import FaunaClient from "../lib/fauna-client";

export default class AddEndpointCommand extends Command {
  static args = {
    name: Args.string({
      description: "Endpoint name",
    }),
  };

  static description = `
Adds an endpoint to ~/.fauna-shell.
`;

  static examples = [
    "$ fauna add-endpoint",
    "$ fauna add-endpoint localhost --url http://localhost:8443/ --key secret",
    "$ fauna add-endpoint localhost --set-default",
  ];

  static flags = {
    url: Flags.string({
      description: "Database URL",
      required: false,
    }),
    secret: Flags.string({
      description: "Database secret",
      required: false,
    }),
    "non-interactive": Flags.boolean({
      description: "Disables interaction",
      dependsOn: ["url", "secret"],
    }),
    "set-default": Flags.boolean({
      description: "Sets this stack as the default",
    }),
  };

  async run() {
    const config = ShellConfig.read({});

    await this.execute(config);
  }

  async execute(config: ShellConfig) {
    const { args, flags } = await this.parse();

    if (args.name === undefined && flags["non-interactive"]) {
      this.error("A name must be given if --non-interactive is set");
    }

    const endpointName =
      args?.name ??
      (await input({
        message: "Endpoint name",
        validate: (name) => {
          if (name === "default") {
            return "Endpoint cannot be named 'default'";
          } else if (Object.keys(config.rootConfig.endpoints).includes(name)) {
            return "Endpoint already exists";
          } else {
            return true;
          }
        },
      }));

    const url =
      flags?.url ??
      (await input({
        message: "Database URL",
        default: "http://localhost:8443",
        validate: async (url) => {
          try {
            // disable no-new lint eslint
            // eslint-disable-next-line no-new
            new URL(url);
            const client = new FaunaClient({
              secret: "secret",
              endpoint: url,
            });
            try {
              // This should fail with unauthorized. If it fails with another
              // error, the URL is probably invalid.
              await client.query(`0`);
            } catch (e) {
              return "Error: could not connect to URL";
            } finally {
              client.close();
            }
            return true;
          } catch (e) {
            return "Error: invalid URL";
          }
        },
      }));

    const secret =
      flags?.secret ??
      (await input({
        message: "Database Secret",
        validate: async (secret) => {
          const client = new FaunaClient({ secret, endpoint: url });
          const res = await client.query(`0`);
          await client.close();
          if (res.status !== 200) {
            return `Error: ${res.body.error.code}`;
          }
          return true;
        },
      }));

    const setDefault =
      flags?.["set-default"] ??
      (flags?.["non-interactive"]
        ? false
        : await confirm({
            message: "Make this endpoint default",
          }));

    if (setDefault) {
      config.rootConfig.defaultEndpoint = endpointName;
    }

    config.rootConfig.endpoints[endpointName] = new Endpoint({
      secret,
      url,
    });
    config.saveRootConfig();

    this.log(`Saved endpoint ${endpointName} to ${getRootConfigPath()}`);
  }
}

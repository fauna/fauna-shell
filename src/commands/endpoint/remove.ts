import { Args, Command } from "@oclif/core";
import { ShellConfig } from "../../lib/config";

export default class RemoveEndpointCommand extends Command {
  static description = "Remove an endpoint from ~/.fauna-shell.";

  static examples = ["$ fauna endpoint remove my_endpoint"];

  static flags = {};

  static args = {
    name: Args.string({
      required: true,
      description: "Endpoint name",
    }),
  };

  static aliases = ["delete-endpoint"];
  static deprecateAliases = true;

  async run() {
    const config = ShellConfig.read({});

    await this.execute(config);
  }

  async execute(config: ShellConfig) {
    const { args } = await this.parse();
    const name = args.name;

    if (config.rootConfig.endpoints[name] === undefined) {
      this.error(`No such endpoint ${name}`);
    }

    // Clear the default if `name` is the default.
    if (config.rootConfig.defaultEndpoint === name) {
      config.rootConfig.defaultEndpoint = undefined;
    }
    delete config.rootConfig.endpoints[name];

    config.saveRootConfig();

    this.log(`Removed endpoint ${name}.`);
  }
}

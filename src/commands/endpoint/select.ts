import { ShellConfig } from "../../lib/config/index";
import { Args, Command } from "@oclif/core";
import { searchSelect } from "../../lib/search-select";

export default class DefaultEndpointCommand extends Command {
  static description = "Set an endpoint as the default one.";

  static examples = [
    "$ fauna endpoint select",
    "$ fauna endpoint select endpoint",
  ];

  static args = {
    name: Args.string({
      required: false,
      description: "New default endpoint",
    }),
  };

  static aliases = ["default-endpoint"];
  static deprecateAliases = true;

  async run() {
    const config = ShellConfig.read({});

    await this.execute(config);
  }

  async execute(config: ShellConfig) {
    const { args } = await this.parse();

    if (Object.keys(config.rootConfig.endpoints).length === 0) {
      this.error("No endpoints defined. Create one with `fauna cloud-login`");
    }

    const name =
      args.name ??
      (await searchSelect({
        message: "Select a new default endpoint",
        choices: Object.keys(config.rootConfig.endpoints).map((endpoint) => ({
          value: endpoint,
        })),
      }));

    if (config.rootConfig.endpoints[name] === undefined) {
      this.error(`No such endpoint ${name}`);
    }

    config.rootConfig.defaultEndpoint = name;
    config.saveRootConfig();

    this.log(`Updated default endpoint to ${name}.`);
  }
}

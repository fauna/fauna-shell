import { Command } from "@oclif/core";
import { ShellConfig } from "../../lib/config";
import chalk from "chalk";

export default class ListEndpointCommand extends Command {
  static flags = {};

  static description = "Lists endpoints in ~/.fauna-shell.";

  static examples = ["$ fauna endpoint list"];

  static aliases = ["list-endpoints"];
  static deprecateAliases = true;

  async run() {
    const config = ShellConfig.read({});

    await this.execute(config);
  }

  async execute(config: ShellConfig) {
    await this.parse();

    this.log("Available endpoints:");
    for (const key of Object.keys(config.rootConfig.endpoints)) {
      if (config.rootConfig.defaultEndpoint === key) {
        this.log(chalk.green("* ") + key);
      } else {
        this.log("  " + key);
      }
    }
  }
}

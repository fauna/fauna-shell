import { Command } from "@oclif/core";
import { ShellConfig } from "../../lib/config";
import chalk from "chalk";

export default class ListEnvironmentCommand extends Command {
  static flags = {};

  static description = `List environments available in \`.fauna-project\`.

NOTE: \`fauna project\` and \`fauna environment\` are still in beta. Behavior is subject to change.`;

  static examples = ["$ fauna environment list"];

  async run() {
    const config = ShellConfig.read({}, this);

    await this.execute(config);
  }

  async execute(config: ShellConfig) {
    await this.parse();

    if (config.projectConfig === undefined) {
      this.error("No project config found");
    }

    this.log("Available environments:");
    for (const key of Object.keys(config.projectConfig.environments)) {
      if (config.projectConfig?.defaultEnvironment === key) {
        this.log(chalk.green("* ") + key);
      } else {
        this.log("  " + key);
      }
    }
  }
}

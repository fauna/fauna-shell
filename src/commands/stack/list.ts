import { Command } from "@oclif/core";
import { ShellConfig } from "../../lib/config";
import chalk from "chalk";

export default class ListStackCommand extends Command {
  static flags = {};

  static description = `List stacks available in \`.fauna-project\`.

NOTE: \`fauna project\` and \`fauna stack\` are still in beta. Behavior is subject to change.`;

  static examples = ["$ fauna stack list"];

  async run() {
    const config = ShellConfig.read({}, this);

    await this.execute(config);
  }

  async execute(config: ShellConfig) {
    await this.parse();

    if (config.projectConfig === undefined) {
      this.error("No project config found");
    }

    this.log("Available stacks:");
    for (const key of Object.keys(config.projectConfig.stacks)) {
      if (config.projectConfig.defaultStack === key) {
        this.log(chalk.green("* ") + key);
      } else {
        this.log("  " + key);
      }
    }
  }
}

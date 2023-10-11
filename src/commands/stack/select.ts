import { Args, Command } from "@oclif/core";
import { ShellConfig } from "../../lib/config";

export default class SelectStackCommand extends Command {
  static args = {
    stack: Args.string({
      description: "The new default stack to use",
      required: true,
    }),
  };

  static description = "Update the default stack in `.fauna-project`.";

  static examples = ["$ fauna stack select my-stack"];

  async run() {
    const config = ShellConfig.read({}, this);

    await this.execute(config);
  }

  async execute(config: ShellConfig) {
    const { args } = await this.parse();

    if (config.projectConfig === undefined) {
      this.error("No project config found");
    }

    if (!Object.keys(config.projectConfig.stacks).includes(args.stack)) {
      this.error(
        `Stack ${args.stack} not found in project config. Run \`fauna stack list\` to see available stacks`
      );
    }

    config.projectConfig.defaultStack = args.stack;
    config.saveProjectConfig();
    console.log(`Selected stack ${args.stack}`);
  }
}

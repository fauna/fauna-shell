import { Args, Command } from "@oclif/core";
import { ShellConfig } from "../../lib/config";

export default class SelectEnvironmentCommand extends Command {
  static args = {
    environment: Args.string({
      description: "The new default environment to use",
      required: true,
    }),
  };

  static description = `Update the default environment in \`.fauna-project\`.

NOTE: \`fauna project\` and \`fauna environment\` are still in beta. Behavior is subject to change.`;

  static examples = ["$ fauna environment select my-environment"];

  async run() {
    const config = ShellConfig.read({}, this);

    await this.execute(config);
  }

  async execute(config: ShellConfig) {
    const { args } = await this.parse();

    if (config.projectConfig === undefined) {
      this.error("No project config found");
    }

    if (
      !Object.keys(config.projectConfig.environments).includes(args.environment)
    ) {
      this.error(
        `Environment ${args.environment} not found in project config. Run \`fauna environment list\` to see available environments`
      );
    }

    config.projectConfig.defaultEnvironment = args.environment;
    config.saveProjectConfig();
    console.log(`Selected environment ${args.environment}`);
  }
}

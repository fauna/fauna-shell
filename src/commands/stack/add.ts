import { Command, Flags } from "@oclif/core";
import { ShellConfig } from "../../lib/config";
import { StackFactory } from "../../lib/stack-factory";

export default class AddStackCommand extends Command {
  static flags = {
    name: Flags.string({
      description: "New stack name",
    }),
    endpoint: Flags.string({
      description: "Endpoint to use in this stack",
    }),
    database: Flags.string({
      description: "Database path to use in this stack",
    }),
    "non-interactive": Flags.boolean({
      description: "Disable interaction",
      dependsOn: ["name", "endpoint", "database"],
    }),
    "set-default": Flags.boolean({
      description: "Set this stack as the default",
    }),
  };

  static description = "Add a new stack to `.fauna-project`.";

  static examples = [
    "$ fauna stack add",
    "$ fauna stack add --name my-app --endpoint dev --database my-database",
    "$ fauna stack add --name my-app --endpoint dev --database my-database --set-default",
  ];

  async run() {
    const config = ShellConfig.read({}, this);

    await this.execute(config);
  }

  async execute(config: ShellConfig) {
    const { flags } = await this.parse();

    if (config.projectConfig === undefined) {
      this.error(
        "No `.fauna-project` found. Create one with `fauna project init`."
      );
    }

    const stackFactory = new StackFactory(this, config);
    await stackFactory.addStack({
      endpoint: flags.endpoint,
      database: flags.database,
      name: flags.name,
      default: flags["set-default"],
      nonInteractive: flags["non-interactive"],
    });
  }
}

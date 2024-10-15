import { Command, Flags } from "@oclif/core";
import { ShellConfig } from "../../lib/config";
import { EnvironmentFactory } from "../../lib/environment-factory";

export default class AddEnvironmentCommand extends Command {
  static flags = {
    name: Flags.string({
      description: "New environment name",
    }),
    endpoint: Flags.string({
      description: "Endpoint to use in this environment",
    }),
    database: Flags.string({
      description: "Database path to use in this environment",
    }),
    "no-input": Flags.boolean({
      char: "y",
      description: "Do not read from user input.",
      default: false,
      dependsOn: ["name", "endpoint", "database"],
    }),
    "set-default": Flags.boolean({
      description: "Set this environment as the default",
    }),
  };

  static description = `Add a new environment to \`.fauna-project\`.`;

  static examples = [
    "$ fauna environment add",
    "$ fauna environment add --name my-app --endpoint dev --database my-database",
    "$ fauna environment add --name my-app --endpoint dev --database my-database --set-default",
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

    const environmentFactory = new EnvironmentFactory(this, config);
    await environmentFactory.addEnvironment({
      endpoint: flags.endpoint,
      database: flags.database,
      name: flags.name,
      default: flags["set-default"],
      nonInteractive: flags["no-input"],
    });
  }
}

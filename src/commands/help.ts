import { Args, Command, Flags } from "@oclif/core";
import CustomHelp from "../custom-help";

/**
 * This class is pulled from:
 * https://github.com/oclif/plugin-help/blob/main/src/commands/help.ts
 * We were previously using the plugin-help to add a help command to the
 * fauna CLI.  This didn't work with custom help classes though so this
 * class has been copied here to allow us to use our custom help class.
 */
export default class HelpCommand extends Command {
  static args = {
    commands: Args.string({
      description: "Command to show help for.",
      required: false,
    }),
  };

  static description = "Display help for <%= config.bin %>.";

  static flags = {
    "nested-commands": Flags.boolean({
      char: "n",
      description: "Include all nested commands in the output.",
    }),
  };

  static strict = false;

  async run(): Promise<void> {
    const { argv, flags } = await this.parse(HelpCommand);
    const help = new CustomHelp(this.config, { all: flags["nested-commands"] });
    await help.showHelp(argv as string[]);
  }
}

import { Args, Command } from "@oclif/core";
import {
  fileExists,
  PROJECT_FILE_NAME,
  ProjectConfig,
  ShellConfig,
} from "../../lib/config";
import * as path from "path";
import { StackFactory } from "../../lib/stack-factory";

export class ProjectInitCommand extends Command {
  static args = {
    projectDir: Args.string({
      name: "projectDir",
      required: false,
      description:
        "The directory to initialize as a fauna project.  If not provided will default to the current directory.",
    }),
  };

  static description =
    "Initializes a directory as a fauna project by generating a .fauna-project file";

  static examples = [
    "$ fauna project init",
    "$ fauna project init path/to/some/other/dir",
  ];

  async run() {
    const { args } = await this.parse();
    const projectDir = this.getProjectPath(args.projectDir);
    this.log(projectDir);
    await this.execute(projectDir);
  }

  async execute(projectDir: string): Promise<void> {
    const projectPath = path.join(projectDir, PROJECT_FILE_NAME);
    if (fileExists(projectPath)) {
      this.error(
        "Attempted to run init for a directory that already has a .fauna-project."
      );
    }
    // todo: show a warning if there is a .fauna-project in an ancestor anywhere up the line

    const shellConfig = ShellConfig.readWithOverrides({
      projectPath: projectPath,
      projectConfig: ProjectConfig.emptyConfig(),
    });
    const stackFactory = new StackFactory(this, shellConfig);
    await stackFactory.addStack({
      default: true,
    });
  }

  private getProjectPath(projectDir?: string): string {
    if (projectDir) {
      if (path.isAbsolute(projectDir)) {
        return projectDir;
      } else {
        return path.join(process.cwd(), projectDir);
      }
    } else {
      return process.cwd();
    }
  }
}

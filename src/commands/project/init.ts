import { Args, Command } from "@oclif/core";
import {
  fileExists,
  getProjectConfigPath,
  PROJECT_FILE_NAME,
  ProjectConfig,
  ShellConfig,
} from "../../lib/config";
import fs from "fs";
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
    "Initialize a project directory by generating a .fauna-project file.";

  static examples = [
    "$ fauna project init",
    "$ fauna project init path/to/some/other/dir",
  ];

  async run() {
    const { args } = await this.parse();
    const projectDir = this.getProjectPath(args.projectDir);
    await this.execute(projectDir);
  }

  async execute(projectDir: string): Promise<void> {
    const stat = fs.statSync(projectDir, {
      // returns undefined instead of throwing if the file doesn't exist
      throwIfNoEntry: false,
    });
    if (stat === undefined) {
      this.error(`No such file or directory ${projectDir}`);
    } else if (!stat.isDirectory()) {
      this.error(`Expected a directory, found file at ${projectDir}`);
    } else {
      try {
        fs.accessSync(projectDir, fs.constants.W_OK);
      } catch (e) {
        this.error(`Cannot write to directory ${projectDir}`);
      }
    }

    const projectPath = path.join(projectDir, PROJECT_FILE_NAME);
    if (fileExists(projectPath)) {
      this.error(`Project already exists at ${projectPath}`);
    }
    this.log(`Creating project at ${projectPath}`);

    const existingProject = getProjectConfigPath(projectPath);
    if (existingProject !== undefined) {
      this.log(
        `Warning: the new project will override the existing project at ${existingProject}`
      );
    }

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

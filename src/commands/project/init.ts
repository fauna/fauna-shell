import { input } from "@inquirer/prompts";
import { Args, Command } from "@oclif/core";
import fs from "fs";
import * as path from "path";
import {
  PROJECT_FILE_NAME,
  ProjectConfig,
  ShellConfig,
  fileExists,
  getProjectConfigPath,
} from "../../lib/config";
import { EnvironmentFactory } from "../../lib/environment-factory";
import { dirExists, dirIsWriteable } from "../../lib/file-util";

export class ProjectInitCommand extends Command {
  static args = {
    projectDir: Args.string({
      name: "projectDir",
      required: false,
      description:
        "The directory to initialize as a fauna project.  If not provided will default to the current directory.",
    }),
  };

  static description = `Initialize a project directory by generating a .fauna-project file.`;

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
    if (!dirExists(projectDir)) {
      this.log(`${projectDir} does not exist, creating it.`);
      fs.mkdirSync(projectDir, { recursive: true });
    } else if (!dirIsWriteable(projectDir)) {
      this.error(`${projectDir} is not writeable.`);
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

    let schemaDir: string | undefined = await input({
      message:
        "What directory would you like to store your schema files in? (defaults to current directory)",
    });
    const fullSchemaPath = path.join(projectDir, schemaDir);
    if (schemaDir === "") {
      schemaDir = undefined;
    } else if (!dirExists(fullSchemaPath)) {
      this.log(
        `The project's schema directory: ${fullSchemaPath} does not exist, creating it.`
      );
      fs.mkdirSync(fullSchemaPath, { recursive: true });
    } else if (!dirIsWriteable(fullSchemaPath)) {
      this.error(
        `The project's schema directory: ${fullSchemaPath} is not writeable.`
      );
    }

    ProjectConfig.initialConfig(schemaDir).save(projectPath);

    const shellConfig = ShellConfig.readWithOverrides({
      projectPath: projectPath,
    });
    const environmentFactory = new EnvironmentFactory(this, shellConfig);
    await environmentFactory.addEnvironment({
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

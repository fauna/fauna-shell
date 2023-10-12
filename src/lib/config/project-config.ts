const ini = require("ini");

import * as fs from "fs";
import { RootConfig, Config, InvalidConfigError } from ".";

// Represents `.fauna-project`
export class ProjectConfig {
  defaultStack?: string;
  schemaDir?: string;
  stacks: { [key: string]: Stack };

  static DEFAULT_FIELD_NAME = "default";
  static SCHEMA_DIRECTORY_FIELD_NAME = "schema_directory";
  static STACK_FIELD_NAME = "stack";
  /**
   * This method is used to obtain an empty project config when fauna project init is used.
   */
  static initialConfig(fslDir?: string): ProjectConfig {
    return new ProjectConfig({}, undefined, fslDir);
  }

  private constructor(
    stacks: { [key: string]: Stack },
    defaultStack?: string,
    schemaDir?: string
  ) {
    this.stacks = stacks;
    this.defaultStack = defaultStack;
    this.schemaDir = schemaDir;
  }

  static fromConfig(config: Config): ProjectConfig {
    const defaultStack = config.strOpt(ProjectConfig.DEFAULT_FIELD_NAME);
    const fslDir = config.strOpt(ProjectConfig.SCHEMA_DIRECTORY_FIELD_NAME);
    const stacks: { [key: string]: Stack } = config.objectExists(
      ProjectConfig.STACK_FIELD_NAME
    )
      ? Object.fromEntries<Stack>(
          config.objectsIn("stack").map(([k, v]) => [k, new Stack(v)])
        )
      : {};

    if (defaultStack && stacks[defaultStack] === undefined) {
      throw new InvalidConfigError(
        `Default stack '${defaultStack}' was not found`
      );
    }

    return new ProjectConfig(stacks, defaultStack, fslDir);
  }

  validate(rootConfig: RootConfig) {
    for (const stack of Object.values(this.stacks)) {
      if (rootConfig.endpoints[stack.endpoint] === undefined) {
        throw new InvalidConfigError(
          `Endpoint '${stack.endpoint}' not found in ~/.fauna-shell`
        );
      }
    }
  }

  save(path: string) {
    const config = {
      ...(this.schemaDir
        ? { [ProjectConfig.SCHEMA_DIRECTORY_FIELD_NAME]: this.schemaDir }
        : {}),
      ...(this.defaultStack
        ? { [ProjectConfig.DEFAULT_FIELD_NAME]: this.defaultStack }
        : {}),
      [ProjectConfig.STACK_FIELD_NAME]: this.stacks,
    };

    const encoded = ini.encode(config);
    fs.writeFileSync(path, encoded);
  }
}

export class Stack {
  /**
   * The endpoint name to use as a base.
   */
  endpoint: string;
  /**
   * The database path to use.
   */
  database: string;

  constructor(config: Config) {
    this.endpoint = config.str("endpoint");
    this.database = config.str("database");
  }
}

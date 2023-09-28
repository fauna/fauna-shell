const ini = require("ini");

import * as fs from "fs";
import { RootConfig, Config, InvalidConfigError } from ".";

// Represents `.fauna-project`
export class ProjectConfig {
  defaultStack?: string;
  stacks: { [key: string]: Stack };

  /**
   * This method is used to obtain an empty project config when fauna project init is used.
   */
  static emptyConfig(): ProjectConfig {
    return new ProjectConfig({});
  }

  private constructor(stacks: { [key: string]: Stack }, defaultStack?: string) {
    this.stacks = stacks;
    this.defaultStack = defaultStack;
  }

  static fromConfig(config: Config): ProjectConfig {
    const defaultStack = config.strOpt("default");
    const stacks: { [key: string]: Stack } = config.objectExists("stack")
      ? Object.fromEntries<Stack>(
          config.objectsIn("stack").map(([k, v]) => [k, new Stack(v)])
        )
      : {};

    if (defaultStack && stacks[defaultStack] === undefined) {
      throw new InvalidConfigError(
        `Default stack '${defaultStack}' was not found`
      );
    }

    return new ProjectConfig(stacks, defaultStack);
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
      default: this.defaultStack,
      stack: this.stacks,
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

const ini = require("ini");

import * as fs from "fs";
import { RootConfig, Config, InvalidConfigError } from ".";

// Represents `.fauna-project`
export class ProjectConfig {
  defaultStack?: string;
  stacks: { [key: string]: Stack };

  constructor(config: Config) {
    this.defaultStack = config.strOpt("default");
    this.stacks = Object.fromEntries(
      config.objectsIn("stack").map(([k, v]) => [k, new Stack(v)])
    );

    if (this.defaultStack && this.stacks[this.defaultStack] === undefined) {
      throw new InvalidConfigError(
        `Default stack '${this.defaultStack}' was not found`
      );
    }
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

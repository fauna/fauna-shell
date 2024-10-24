const ini = require("ini");

import * as fs from "fs";
import { Config, InvalidConfigError, RootConfig } from ".";

// Represents `.fauna-project`
export class ProjectConfig {
  defaultEnvironment?: string;
  schemaDir?: string;
  environments: { [key: string]: Environment };

  static DEFAULT_FIELD_NAME = "default";
  static SCHEMA_DIRECTORY_FIELD_NAME = "schema_directory";
  static ENVIRONMENT_FIELD_NAME = "environment";
  /**
   * This method is used to obtain an empty project config when fauna project init is used.
   */
  static initialConfig(fslDir?: string): ProjectConfig {
    return new ProjectConfig({}, undefined, fslDir);
  }

  private constructor(
    environments: { [key: string]: Environment },
    defaultEnvironment?: string,
    schemaDir?: string,
  ) {
    this.environments = environments;
    this.defaultEnvironment = defaultEnvironment;
    this.schemaDir = schemaDir;
  }

  static fromConfig(config: Config): ProjectConfig {
    const defaultEnvironment = config.strOpt(ProjectConfig.DEFAULT_FIELD_NAME);
    const fslDir = config.strOpt(ProjectConfig.SCHEMA_DIRECTORY_FIELD_NAME);
    const environments: { [key: string]: Environment } = config.objectExists(
      ProjectConfig.ENVIRONMENT_FIELD_NAME,
    )
      ? Object.fromEntries<Environment>(
          config
            .objectsIn("environment")
            .map(([k, v]) => [k, new Environment(v)]),
        )
      : {};

    if (defaultEnvironment && environments[defaultEnvironment] === undefined) {
      throw new InvalidConfigError(
        `Default environment '${defaultEnvironment}' was not found`,
      );
    }

    return new ProjectConfig(environments, defaultEnvironment, fslDir);
  }

  validate(rootConfig: RootConfig) {
    for (const environment of Object.values(this.environments)) {
      if (rootConfig.endpoints[environment.endpoint] === undefined) {
        throw new InvalidConfigError(
          `Endpoint '${environment.endpoint}' not found in ~/.fauna-shell`,
        );
      }
    }
  }

  save(path: string) {
    const config = {
      ...(this.schemaDir
        ? {
            [ProjectConfig.SCHEMA_DIRECTORY_FIELD_NAME]: this.schemaDir,
          }
        : {}),
      ...(this.defaultEnvironment
        ? {
            [ProjectConfig.DEFAULT_FIELD_NAME]: this.defaultEnvironment,
          }
        : {}),
      [ProjectConfig.ENVIRONMENT_FIELD_NAME]: this.environments,
    };

    const encoded = ini.encode(config);
    fs.writeFileSync(path, encoded);
  }
}

export class Environment {
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

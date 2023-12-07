// Manages ~/.fauna-shell

import fs from "fs";
import os from "os";
import path from "path";
const ini = require("ini");

import { Secret } from "../secret";
import { Environment, ProjectConfig } from "./project-config";
import { Endpoint, RootConfig } from "./root-config";

export { Endpoint, Environment, ProjectConfig, RootConfig };

export const PROJECT_FILE_NAME = ".fauna-project";

export class InvalidConfigError extends Error {}

// Wraps an `ini` file with helpers to get typed values out
export class Config {
  keyName: string;
  private config: { [key: string]: unknown };

  constructor(keyName: string, config: { [key: string]: unknown }) {
    this.keyName = keyName;
    this.config = config;
  }

  strOpt(key: string): string | undefined {
    const v = this.config[key];
    if (v === undefined || typeof v === "string") {
      return v;
    } else {
      throw new InvalidConfigError(
        `Expected string for ${this.keyName} ${key}, got ${typeof v}`
      );
    }
  }

  keys(): Array<string> {
    return Object.keys(this.config);
  }

  numberOpt(key: string): number | undefined {
    const v = this.config[key];
    if (v === undefined || typeof v === "number") {
      return v;
    } else if (typeof v === "string") {
      try {
        return parseInt(v, 10);
      } catch (_) {
        throw new InvalidConfigError(
          `Invalid number for ${this.keyName} ${key}`
        );
      }
    } else {
      throw new InvalidConfigError(
        `Expected number for ${this.keyName} ${key}, got ${typeof v}`
      );
    }
  }

  object(key: string): Config {
    const v = this.config[key];
    if (v === undefined) {
      throw new InvalidConfigError(
        `Missing value for required ${this.keyName} ${key}`
      );
    } else if (v !== null && typeof v === "object") {
      return new Config(this.keyName, v as any);
    } else {
      throw new InvalidConfigError(
        `Expected object for ${this.keyName} ${key}, got ${typeof v}`
      );
    }
  }

  objectExists(key: string): boolean {
    const v = this.config[key];
    return v !== undefined && typeof v === "object";
  }

  str(key: string): string {
    return this.require(key, this.strOpt(key));
  }

  number(key: string): number {
    return this.require(key, this.numberOpt(key));
  }

  require<T>(key: string, value: T | undefined): T {
    if (value === undefined) {
      throw new InvalidConfigError(
        `Missing value for required ${this.keyName} ${key}`
      );
    } else {
      return value;
    }
  }

  // Returns a list of all keys that match `pred`.
  allObjectsWhere(pred: (_: string) => boolean): [string, Config][] {
    return Object.keys(this.config).flatMap((k: string) =>
      pred(k) ? [[k, this.object(k)]] : []
    );
  }

  // Returns a list of all child objects of the given `key`.
  objectsIn(key: string) {
    const obj = this.object(key);
    return obj.allObjectsWhere((_) => true);
  }
}

export type ShellOpts = {
  flags?: { [key: string]: any };
  rootConfig?: { [key: string]: any };
  projectPath?: string;
  projectConfig?: { [key: string]: any };
};

export type EndpointConfig = {
  secret: Secret;
  url: string;
  name?: string;
  graphqlHost: string;
  graphqlPort: number;
};

export interface LogChannel {
  warn(_: string): void;
  log(_: string): void;
}

export class ShellConfig {
  // fields from CLI and files
  flags: Config;
  rootConfig: RootConfig;
  projectConfig: ProjectConfig | undefined;

  // If `--secret` is passed, this will be set.
  secretFlag?: Secret;
  // The selected environment from the project config. If there is a project config, this will also be set.
  environment: Environment | undefined;
  // The fully configured endpoint, including command line flags that override things like the URL.
  //
  // If this is unset, `validate` will fail.
  endpoint: Endpoint | undefined;
  // The path to the project config.
  projectPath: string | undefined;

  // Errors that came up in the config to be displayed.
  errors: string[] = [];

  static read(flags: any, log?: LogChannel) {
    const rootConfig = ini.parse(readFileOpt(getRootConfigPath()));
    const projectConfigPath = getProjectConfigPath();
    const projectConfig = projectConfigPath
      ? ini.parse(readFile(projectConfigPath))
      : undefined;

    const shellConfig = new ShellConfig({
      flags,
      rootConfig,
      projectPath:
        projectConfigPath !== undefined
          ? path.dirname(projectConfigPath)
          : undefined,
      projectConfig,
    });

    if (log !== undefined) {
      shellConfig.configErrors().forEach((err) => log.warn(err));
    }

    return shellConfig;
  }

  static readWithOverrides(opts?: ShellOpts): ShellConfig {
    const rootConfig =
      opts?.rootConfig ?? ini.parse(readFileOpt(getRootConfigPath()));
    const projectConfigPath = opts?.projectPath ?? getProjectConfigPath();
    const projectConfig =
      opts?.projectConfig ??
      (projectConfigPath ? ini.parse(readFile(projectConfigPath)) : undefined);

    return new ShellConfig({
      rootConfig,
      projectPath:
        projectConfigPath !== undefined
          ? path.dirname(projectConfigPath)
          : undefined,
      projectConfig,
    });
  }

  constructor(opts: ShellOpts) {
    this.flags = new Config("flag", opts.flags ?? {});

    this.rootConfig = new RootConfig(
      new Config("config key", opts.rootConfig ?? {})
    );
    this.projectPath = opts.projectPath;
    this.projectConfig = opts.projectConfig
      ? ProjectConfig.fromConfig(new Config("config key", opts.projectConfig))
      : undefined;

    const urlFlag = Endpoint.getURLFromFlags(this.flags);
    if (urlFlag !== undefined) {
      try {
        // eslint-disable-next-line no-new
        new URL(urlFlag);
      } catch (e) {
        throw new Error(`Invalid database URL: ${urlFlag}`);
      }
    }

    const environmentFlag = this.flags.strOpt("environment");

    if (this.projectConfig === undefined) {
      if (environmentFlag !== undefined) {
        throw new Error(
          `No ${PROJECT_FILE_NAME} was found, so environment '${environmentFlag}' cannot be used`
        );
      }
    } else {
      const environmentName =
        environmentFlag ?? this.projectConfig.defaultEnvironment;

      if (environmentName !== undefined) {
        this.environment = this.projectConfig.environments[environmentName];
        // we don't need to blow up here because commands that aren't using project config
        // can hit this.  cloud-login could be trying to add the needed endpoint.
        // the project config will also be validated for any commands attempting to use it.
        if (this.environment === undefined) {
          this.errors.push(`No such environment '${environmentName}'`);
        }
      }
    }

    // An endpoint must be chosen as well. The endpoint may come from (in order)
    // the `--endpoint` flag, the `endpoint` key in the project config, or the
    // `default` key in the root config.
    const endpointName =
      this.flags.strOpt("endpoint") ??
      this.environment?.endpoint ??
      this.rootConfig.defaultEndpoint;

    const secretFlag = this.flags.strOpt("secret");
    this.secretFlag =
      secretFlag !== undefined ? Secret.parseFlag(secretFlag) : undefined;

    if (secretFlag !== undefined && environmentFlag !== undefined) {
      throw new Error(
        "Cannot specify both --secret and --environment, as --secret will override the settings from a environment."
      );
    }

    // There are 2 scenarios where we want to execute the first if block:
    // 1. no endpoint name is set
    // 2. In a CI/CD environment where a secret is set but there is no
    // root config.  In this scenario endpoints may be set by the project
    // configuration but won't exist in their pipeline workspace.
    if (
      endpointName === undefined ||
      (secretFlag !== undefined && this.rootConfig.isEmpty())
    ) {
      // This is a dummy secret. `--secret` must be set in this case, which
      // `validate` enforces.
      this.endpoint = new Endpoint({
        secret: new Secret({ key: "", allowDatabase: true }),
        url: urlFlag,
        graphqlHost: this.flags.strOpt("graphqlHost"),
        graphqlPort: this.flags.numberOpt("graphqlPort"),
      });
    } else {
      this.endpoint = this.rootConfig.endpoints[endpointName];
      if (this.endpoint !== undefined) {
        this.endpoint.url = urlFlag ?? this.endpoint.url;
        this.endpoint.graphqlHost =
          this.flags.strOpt("graphqlHost") ?? this.endpoint.graphqlHost;
        this.endpoint.graphqlPort =
          this.flags.numberOpt("graphqlHost") ?? this.endpoint.graphqlPort;
      }
    }
  }

  validate = () => {
    if (this.endpoint === undefined && this.secretFlag === undefined) {
      // No `~/.fauna-shell` was found, and no `--secret` was passed.
      throw new Error(
        `No endpoint or secret set. Set an endpoint in ~/.fauna-shell, ${PROJECT_FILE_NAME}, or pass --endpoint`
      );
      /**
       * If there is no secret flag set we need to ensure we validate we can find a secret
       * from the endpoint.  Additionally if there is a root config present, we
       * want to validate that things line up with the project.  Even if a secret
       * flag is set, there could be other properties of the endpoint that we need to
       * pull in, url being the current one.
       * The inverse of this is the running from a pipeline scenario where there is a secret
       * set and no root config.  In that case we don't want to validate the project configuration.
       */
    } else if (this.secretFlag === undefined || !this.rootConfig.isEmpty()) {
      this.projectConfig?.validate(this.rootConfig);
    }
  };

  lookupEndpoint = (opts: { scope?: string }): EndpointConfig => {
    this.validate();

    if (this.secretFlag !== undefined) {
      const endpoint = this.endpoint!.makeScopedEndpoint();
      endpoint.secret = this.secretFlag;
      return endpoint;
    } else {
      let database = this.environment?.database.split("/") ?? [];
      if (opts.scope !== undefined) {
        database.push(...opts.scope.split("/"));
      }

      return this.endpoint!.makeScopedEndpoint(database);
    }
  };

  configErrors(): string[] {
    if (this.rootConfig.invalidEndpoints.length > 0) {
      return [
        `The following endpoint definitions in ${getRootConfigPath()} are invalid:\n ${this.rootConfig.invalidEndpoints.join(
          "\n"
        )}\n Resolve them by ensuring they have a secret defined or remove them if they are not needed.`,
        ...this.errors,
      ];
    }
    if (!fileExistsWithPermission600(getRootConfigPath())) {
      if (fileExists(getRootConfigPath())) {
        return [
          `${getRootConfigPath()} should have 600 permission. Update the permission of this file.`,
          ...this.errors,
        ];
      } else {
        return [`${getRootConfigPath()} does not exist.`, ...this.errors];
      }
    }

    return [];
  }

  /**
   * Saves the project config, if present.
   */
  saveProjectConfig() {
    this.projectConfig?.save(this.projectConfigFile()!);
  }

  /**
   * Saves the root config.
   */
  saveRootConfig() {
    if (this.rootConfig.invalidEndpoints.length > 0) {
      throw new Error(
        `The following endpoint definitions in ${getRootConfigPath()} are invalid:\n ${this.rootConfig.invalidEndpoints.join(
          "\n"
        )}\n Resolve them by ensuring they have a secret defined or remove them if they are not needed.`
      );
    }
    this.rootConfig.save(getRootConfigPath());
  }

  projectConfigFile(): string | undefined {
    return this.projectPath === undefined
      ? undefined
      : path.join(this.projectPath, PROJECT_FILE_NAME);
  }
}

const readFileOpt = (fileName: string) => {
  if (fs.existsSync(fileName)) {
    return fs.readFileSync(fileName, "utf8");
  } else {
    return "";
  }
};

const readFile = (fileName: string) => {
  return fs.readFileSync(fileName, "utf8");
};

export const getRootConfigPath = () => {
  return path.join(os.homedir(), ".fauna-shell");
};

export const getProjectConfigPath = (start?: string): string | undefined => {
  let current = start;
  if (current === undefined) {
    try {
      current = process.cwd();
    } catch (err) {
      // If the cwd is not accessible, just give up. If this happens, one of our
      // dependencies actually explodes elsewhere, but we might as well handle
      // errors where possible.
      return undefined;
    }
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const projPath = path.join(current, PROJECT_FILE_NAME);
    if (fileExists(projPath)) {
      return projPath;
    }

    const currPath = path.parse(current);
    // break if at root
    if (currPath.base === "") {
      break;
    }
    current = currPath.dir;
  }

  // if we got here, it means that there was no `.fauna-project` file, so we
  // give up.
  return undefined;
};

export const fileExists = (filePath: string): boolean => {
  const stat = fs.statSync(filePath, {
    // returns undefined instead of throwing if the file doesn't exist
    throwIfNoEntry: false,
  });
  return stat !== undefined && stat.isFile();
};

export const fileExistsWithPermission600 = (
  filePath: string | undefined
): boolean => {
  try {
    if (filePath === undefined) {
      return false;
    }
    const stat = fs.statSync(filePath);

    // Check if it's a file and has permission 600
    return stat.isFile() && (stat.mode & 0o777) === 0o600;
  } catch (error) {
    // Handle the case where the file doesn't exist or other errors
    return false;
  }
};

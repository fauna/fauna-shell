// Manages ~/.fauna-shell

import fs from "fs";
import os from "os";
import path from "path";
const ini = require("ini");

import { ProjectConfig, Stack } from "./project-config";
import { RootConfig, Endpoint } from "./root-config";

export { RootConfig, ProjectConfig, Endpoint, Stack };

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
  secret: string;
  url: string;
  graphqlHost: string;
  graphqlPort: number;
};

export class ShellConfig {
  // fields from CLI and files
  flags: Config;
  rootConfig: RootConfig;
  projectConfig: ProjectConfig | undefined;

  // The selected stack from the project config. If there is a project config, this will also be set.
  stack: Stack | undefined;
  // The fully configured endpoint, including command line flags that override things like the URL.
  //
  // If this is unset, `validate` will fail.
  endpoint: Endpoint | undefined;
  // The path to the project config.
  projectPath: string | undefined;

  static read(flags: any) {
    const rootConfig = ini.parse(readFileOpt(getRootConfigPath()));
    const projectConfigPath = getProjectConfigPath();
    const projectConfig = projectConfigPath
      ? ini.parse(readFile(projectConfigPath))
      : undefined;

    return new ShellConfig({
      flags,
      rootConfig,
      projectPath:
        projectConfigPath !== undefined
          ? path.dirname(projectConfigPath)
          : undefined,
      projectConfig,
    });
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

    this.projectConfig?.validate(this.rootConfig);

    const urlFlag = Endpoint.getURLFromFlags(this.flags);
    if (urlFlag !== undefined) {
      try {
        // eslint-disable-next-line no-new
        new URL(urlFlag);
      } catch (e) {
        throw new Error(`Invalid database URL: ${urlFlag}`);
      }
    }

    if (this.projectConfig === undefined) {
      const stackName = this.flags.strOpt("stack");
      if (stackName !== undefined) {
        throw new Error(
          `No ${PROJECT_FILE_NAME} was found, so stack '${stackName}' cannot be used`
        );
      }
    } else {
      const stackName =
        this.flags.strOpt("stack") ?? this.projectConfig.defaultStack;

      if (stackName !== undefined) {
        this.stack = this.projectConfig.stacks[stackName];
        if (this.stack === undefined) {
          throw new Error(`No such stack '${stackName}'`);
        }
      }
    }

    // An endpoint must be chosen as well. The endpoint may come from (in order)
    // the `--endpoint` flag, the `endpoint` key in the project config, or the
    // `default` key in the root config.
    const endpointName =
      this.flags.strOpt("endpoint") ??
      this.stack?.endpoint ??
      this.rootConfig.defaultEndpoint;

    const secretFlag = this.flags.strOpt("secret");

    if (endpointName === undefined) {
      // No `~/.fauna-shell` was found, so `--secret` is required to make an endpoint. If `--secret` wasn't passed, `validate` should fail.
      if (secretFlag !== undefined) {
        this.endpoint = new Endpoint({
          secret: secretFlag,
          url: urlFlag,
          graphqlHost: this.flags.strOpt("graphqlHost"),
          graphqlPort: this.flags.numberOpt("graphqlPort"),
        });
      }
    } else {
      this.endpoint = this.rootConfig.endpoints[endpointName];
      if (this.endpoint === undefined) {
        throw new Error(`No such endpoint '${endpointName}'`);
      }

      // override endpoint with values from flags.
      this.endpoint.secret = secretFlag ?? this.endpoint.secret;
      this.endpoint.url = urlFlag ?? this.endpoint.url;
      this.endpoint.graphqlHost =
        this.flags.strOpt("graphqlHost") ?? this.endpoint.graphqlHost;
      this.endpoint.graphqlPort =
        this.flags.numberOpt("graphqlHost") ?? this.endpoint.graphqlPort;
    }
  }

  validate = () => {
    if (this.endpoint === undefined) {
      // No `~/.fauna-shell` was found, and no `--secret` was passed.
      throw new Error(
        `No endpoint or secret set. Set an endpoint in ~/.fauna-shell, ${PROJECT_FILE_NAME}, or pass --endpoint`
      );
    }
  };

  lookupEndpoint = (opts: {
    scope?: string;
    role?: string;
  }): EndpointConfig => {
    this.validate();

    let database = this.stack?.database ?? "";
    if (opts.scope !== undefined) {
      if (this.stack !== undefined) {
        database += "/";
      }
      database += opts.scope;
    }

    return this.endpoint!.makeScopedEndpoint(database, opts.role);
  };

  /**
   * Saves the project config, if present.
   */
  saveProjectConfig() {
    this.projectConfig?.save(this.projectConfigFile()!);
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

export const getProjectConfigPath = (): string | undefined => {
  let current;
  try {
    current = process.cwd();
  } catch (err) {
    // If the cwd is not accessible, just give up. If this happens, one of our
    // dependencies actually explodes elsewhere, but we might as well handle
    // errors where possible.
    return undefined;
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

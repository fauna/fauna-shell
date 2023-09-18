// Manages ~/.fauna-shell

import fs from "fs";
import os from "os";
import path from "path";
const ini = require("ini");

import { ProjectConfig, Stack } from "./project-config";
import { RootConfig, Endpoint } from "./root-config";

export { RootConfig, ProjectConfig, Endpoint, Stack };

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
        return parseInt(v);
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
  allObjectsWhere(pred: (key: string) => boolean): [string, Config][] {
    return Object.keys(this.config).flatMap((k) =>
      pred(k) ? [[k, this.object(k)]] : []
    );
  }

  // Returns a list of all child objects of the given `key`.
  objectsIn(key: string) {
    const obj = this.object(key);
    return obj.allObjectsWhere((_) => true);
  }
}

/**
 * Builds the options provided to the faunajs client.
 * Tries to load the ~/.fauna-shell file and read the default endpoint from there.
 *
 * Assumes that if the file exists, it would have been created by fauna-shell,
 * therefore it would have a defined endpoint.
 *
 * Flags like --host, --port, etc., provided by the CLI take precedence over what's
 * stored in ~/.fauna-shell.
 *
 * The --endpoint flag overries the default endpoint from fauna-shell.
 *
 * If ~/.fauna-shell doesn't exist, tries to build the connection options from the
 * flags passed to the script.
 *
 * It always expect a secret key to be set in ~/.fauna-shell or provided via CLI
 * arguments.
 *
 * TODO: Remove and store a ShellConfig in `fauna-command`
 */
export const lookupEndpoint = (flags: any, scope: string, role: string) => {
  return ShellConfig.read(flags).lookupEndpoint({ scope, role });
};

export type ShellOpts = {
  flags?: { [key: string]: any };
  rootConfig?: { [key: string]: any };
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
  endpoint: Endpoint;

  static read(flags: any) {
    const rootConfig = ini.parse(readFileOpt(getRootConfigPath()));
    const projectConfigPath = getProjectConfigPath();
    const projectConfig = projectConfigPath
      ? ini.parse(readFile(projectConfigPath))
      : undefined;

    return new ShellConfig({
      flags,
      rootConfig,
      projectConfig,
    });
  }

  constructor(opts: ShellOpts) {
    this.flags = new Config("flag", opts.flags ?? {});

    this.rootConfig = new RootConfig(
      new Config("config key", opts.rootConfig ?? {})
    );
    this.projectConfig = opts.projectConfig
      ? new ProjectConfig(new Config("config key", opts.projectConfig))
      : undefined;

    this.projectConfig?.validate(this.rootConfig);

    const urlFlag = Endpoint.getURLFromConfig(this.flags);
    if (urlFlag !== undefined) {
      try {
        new URL(urlFlag);
      } catch (e) {
        throw new Error(`Invalid database URL: ${urlFlag}`);
      }
    }

    if (this.projectConfig === undefined) {
      const stackName = this.flags.strOpt("stack");
      if (stackName !== undefined) {
        throw new Error(
          `No .fauna-project was found, so stack '${stackName}' cannot be used`
        );
      }
    } else {
      const stackName =
        this.flags.strOpt("stack") ?? this.projectConfig.defaultStack;

      if (stackName === undefined) {
        throw new Error(
          `A stack must be chosen. Use \`fauna stack default\` or pass --stack to select one`
        );
      }

      this.stack = this.projectConfig.stacks[stackName];
      if (this.stack === undefined) {
        throw new Error(`No such stack '${stackName}'`);
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
      // No `~/.fauna-shell` was found, so `--secret` is required, and then fill in some defaults.
      if (secretFlag === undefined) {
        throw new Error(
          "No endpoint or secret set. Set an endpoint in ~/.fauna-shell, .fauna-project, or pass --endpoint"
        );
      }

      this.endpoint = new Endpoint({
        secret: secretFlag,
        url: urlFlag,
        graphqlHost: this.flags.strOpt("graphqlHost"),
        graphqlPort: this.flags.numberOpt("graphqlPort"),
      });
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

  lookupEndpoint = (opts: {
    scope?: string;
    role?: string;
  }): EndpointConfig => {
    let database = this.stack?.database ?? "";
    if (opts.scope !== undefined) {
      if (this.stack !== undefined) {
        database += "/";
      }
      database += opts.scope;
    }

    return this.endpoint.makeScopedEndpoint(database, opts.role);
  };
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

const getRootConfigPath = () => {
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

  while (true) {
    const projPath = path.join(current, ".fauna-project");
    let stat;
    stat = fs.statSync(projPath, {
      // returns undefined instead of throwing if the file doesn't exist
      throwIfNoEntry: false,
    });
    if (stat !== undefined && stat.isFile()) {
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

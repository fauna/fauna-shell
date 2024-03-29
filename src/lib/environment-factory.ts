import { confirm, input } from "@inquirer/prompts";
import { Command, ux } from "@oclif/core";
import { Endpoint, ShellConfig } from "./config";
import FaunaClient, { QueryFailure, QuerySuccess } from "./fauna-client";
import { searchSelect } from "./search-select";

export interface AddEnvironmentParams {
  endpoint?: string;
  database?: string;
  name?: string;
  default?: boolean;
  nonInteractive?: boolean;
}

export class EnvironmentFactory {
  cmd: Command;
  config: ShellConfig;

  constructor(cmd: Command, config: ShellConfig) {
    this.cmd = cmd;
    this.config = config;
  }

  async askEndpoint(): Promise<string> {
    const useDefault =
      this.config.rootConfig.defaultEndpoint !== undefined &&
      (await confirm({
        message: `Use the default endpoint [${this.config.rootConfig.defaultEndpoint}]`,
      }));

    if (useDefault) {
      return this.config.rootConfig.defaultEndpoint!;
    }

    return searchSelect({
      message: "Select an endpoint",
      choices: Object.keys(this.config.rootConfig.endpoints).map(
        (endpoint) => ({
          value: endpoint,
        })
      ),
    });
  }

  /**
   *
   * @param cmd - used to send info/errors to the user.
   * This method will be executed from the project init as well as environment add method
   * @param config
   */
  async addEnvironment(params?: AddEnvironmentParams) {
    if (
      params?.endpoint === undefined &&
      Object.keys(this.config.rootConfig.endpoints).length === 0
    ) {
      this.cmd.error(
        "No endpoints found. Use `fauna cloud-login` to configure an endpoint."
      );
    }

    const validateEnvironmentName = (input: string) => {
      if (input.length === 0) {
        return "Environment name cannot be empty";
      } else if (
        Object.keys(this.config.projectConfig?.environments ?? {}).includes(
          input
        )
      ) {
        return `Environment ${input} already exists`;
      } else {
        return true;
      }
    };

    const name =
      params?.name ??
      (await input({
        message: "Environment name",
        validate: validateEnvironmentName,
      }));
    const res = validateEnvironmentName(name);
    if (res !== true) {
      this.cmd.error(res as string);
    }

    const endpointName = params?.endpoint ?? (await this.askEndpoint());

    if (!Object.keys(this.config.rootConfig.endpoints).includes(endpointName)) {
      this.cmd.error(`No such endpoint '${endpointName}'`);
    }

    let databaseName: string =
      params?.database ??
      (await this.promptDatabasePath(
        this.config.rootConfig.endpoints[endpointName]
      ));

    const setDefault =
      params?.default ??
      (params?.nonInteractive
        ? false
        : await confirm({
            message: "Make this environment default",
          }));

    if (setDefault) {
      this.config.projectConfig!.defaultEnvironment = name;
    }

    this.config.projectConfig!.environments[name] = {
      endpoint: endpointName,
      database: databaseName,
    };
    this.config.saveProjectConfig();
    console.log(
      `Saved environment ${name} to ${this.config.projectConfigFile()}`
    );
  }

  promptDatabasePath = async (endpoint: Endpoint): Promise<string> => {
    const { url, secret } = endpoint;
    const client = new FaunaClient({
      endpoint: url,
      secret: secret.buildSecret(),
    });

    const res = await client.query("0");
    if (res.status !== 200) {
      this.cmd.error(`${(res as QueryFailure).body.error.code}`);
    }

    const databasePaths = await this.getDatabasePaths(client);

    if (databasePaths === undefined) {
      const res = await input({
        message: "Enter a database path",
        validate: async (path) => {
          if (await this.validateDatabasePath(client, path)) {
            return true;
          } else {
            return `No such database ${path}`;
          }
        },
      });
      return res;
    } else if (databasePaths.length === 0) {
      this.cmd.error("No databases found in the given endpoint");
    } else {
      return searchSelect({
        message: "Select a database",
        choices: databasePaths.map((database) => ({
          value: database,
        })),
      });
    }
  };

  validateDatabasePath = async (
    client: FaunaClient,
    path: string
  ): Promise<boolean> => {
    const res = await client.query<string[]>(`0`, {
      secret: `${client.secret}:${path}:admin`,
    });
    return res.status === 200;
  };

  getDatabasePaths = async (
    client: FaunaClient
  ): Promise<string[] | undefined> => {
    // Limits: choose a limit of 100 databases at each depth, and a depth of 3.
    // We will also add a limit if any databases are skiped.
    const databaseLimit = 100;
    const depthLimit = 3;

    const allDatabases: string[] = [];
    const paths: string[][] = [[]];

    let overflowedLimit = false;
    let overflowedDepth = false;

    ux.action.start("Fetching databases");

    // eslint-disable-next-line no-constant-condition
    while (!overflowedLimit && !overflowedDepth) {
      const path = paths.pop();
      if (path === undefined) {
        break;
      }
      if (path.length > depthLimit) {
        overflowedDepth = true;
        continue;
      }

      const databases = await client.query<string[]>(
        `Database.all().take(${databaseLimit + 1}).toArray().map(.name)`,
        {
          secret: `${client.secret}:${path.join("/")}:admin`,
        }
      );
      if (databases.status !== 200) {
        this.cmd.error(`Error: ${(databases as QueryFailure).body.error.code}`);
      }

      const dbs = (databases as QuerySuccess<any>).body.data;

      if (dbs.length > databaseLimit) {
        overflowedLimit = true;
      }

      const nestedPaths = dbs.map((database: any) => [...path, database]);

      paths.push(...nestedPaths);
      allDatabases.push(...nestedPaths.map((path: any) => path.join("/")));
    }

    ux.action.stop();

    if (overflowedDepth || overflowedLimit) {
      this.cmd.log(
        "Note: there are too many databases to display in this endpoint"
      );
      return undefined;
    } else {
      allDatabases.sort();

      return allDatabases;
    }
  };
}

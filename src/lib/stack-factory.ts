import { Command, ux } from "@oclif/core";
import { input, confirm } from "@inquirer/prompts";
import { Endpoint, ShellConfig } from "./config";
import { searchSelect } from "./search-select";
import FaunaClient, { QuerySuccess } from "./fauna-client";

export interface AddStackParams {
  endpoint?: string;
  database?: string;
  name?: string;
  default?: boolean;
  nonInteractive?: boolean;
}

export class StackFactory {
  cmd: Command;
  config: ShellConfig;

  constructor(cmd: Command, config: ShellConfig) {
    this.cmd = cmd;
    this.config = config;
  }
  /**
   *
   * @param cmd - used to send info/errors to the user.
   * This method will be executed from the project init as well as stack add method
   * @param config
   */
  async addStack(params?: AddStackParams) {
    const endpointName =
      params?.endpoint ??
      (await searchSelect({
        message: "Select an endpoint",
        choices: Object.keys(this.config.rootConfig.endpoints).map(
          (endpoint) => ({
            value: endpoint,
          })
        ),
      }));

    if (!Object.keys(this.config.rootConfig.endpoints).includes(endpointName)) {
      this.cmd.error(`No such endpoint '${endpointName}'`);
    }

    let databaseName: string =
      params?.database ??
      (await this.promptDatabasePath(
        this.config.rootConfig.endpoints[endpointName]
      ));

    const validateStackName = (input: string) => {
      if (input.length === 0) {
        return "Stack name cannot be empty";
      } else if (
        Object.keys(this.config.projectConfig?.stacks ?? {}).includes(input)
      ) {
        return `Stack ${input} already exists`;
      } else {
        return true;
      }
    };

    const name =
      params?.name ??
      (await input({
        message: "Stack name",
        validate: validateStackName,
      }));
    const res = validateStackName(name);
    if (res !== true) {
      this.cmd.error(res as string);
    }

    const setDefault =
      params?.default ??
      (params?.nonInteractive
        ? false
        : await confirm({
            message: "Make this stack default",
          }));

    if (setDefault) {
      this.config.projectConfig!.defaultStack = name;
    }

    this.config.projectConfig!.stacks[name] = {
      endpoint: endpointName,
      database: databaseName,
    };
    this.config.saveProjectConfig();
    console.log(`Saved stack ${name} to ${this.config.projectConfigFile()}`);
  }

  promptDatabasePath = async (endpoint: Endpoint): Promise<string> => {
    const { url, secret } = endpoint;
    const client = new FaunaClient({ endpoint: url, secret });

    const res = await client.query("0");
    if (res.status !== 200) {
      this.cmd.error(`Error: ${res.body.error.code}`);
    }

    const databasePaths = await this.getDatabasePaths(client);

    await client.close();

    return searchSelect({
      message: "Select a database",
      choices: databasePaths.map((database) => ({
        value: database,
      })),
    });
  };

  getDatabasePaths = async (client: FaunaClient): Promise<string[]> => {
    // Limits: choose a limit of 100 databases at each depth, and a depth of 10.
    // We will also add a limit if any databases are skiped.
    const databaseLimit = 100;
    const depthLimit = 10;

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
        this.cmd.error(`Error: ${databases.body.error.code}`);
      }

      const dbs = (databases as QuerySuccess<any>).body.data;

      if (dbs.length > databaseLimit) {
        overflowedLimit = true;
      }

      const nestedPaths = dbs.map((database: any) => [...path, database]);

      paths.push(...nestedPaths);
      allDatabases.push(...nestedPaths.map((path: any) => path.join("/")));
    }

    allDatabases.sort();

    ux.action.stop();

    return allDatabases;
  };
}

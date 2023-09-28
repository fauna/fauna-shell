import { Command, Flags, ux } from "@oclif/core";
import { input, confirm } from "@inquirer/prompts";
import { Endpoint, ShellConfig } from "../../lib/config";
import FaunaClient from "../../lib/fauna-client";
import { searchSelect } from "../../lib/search-select";

export default class AddStackCommand extends Command {
  static flags = {
    name: Flags.string({
      description: "New stack name",
    }),
    endpoint: Flags.string({
      description: "Endpoint to use in this stack",
    }),
    database: Flags.string({
      description: "Database path to use in this stack",
    }),
    "non-interactive": Flags.boolean({
      description: "Disables interaction",
      dependsOn: ["name", "endpoint", "database"],
    }),
    "set-default": Flags.boolean({
      description: "Sets this stack as the default",
    }),
  };

  static description = "Adds a new stack to the `.fauna-project`.";

  static examples = [
    "$ fauna stack add",
    "$ fauna stack add --name my-app --endpoint dev --database my-database",
    "$ fauna stack add --name my-app --endpoint dev --database my-database --set-default",
  ];

  async run() {
    const config = ShellConfig.read({});

    await this.execute(config);
  }

  async execute(config: ShellConfig) {
    const { flags } = await this.parse();

    if (config.projectConfig === undefined) {
      this.error(
        "No `.fauna-project` found. Create one with `fauna project init`."
      );
    }

    const endpointName =
      flags.endpoint ??
      (await searchSelect({
        message: "Select an endpoint",
        choices: Object.keys(config.rootConfig.endpoints).map((endpoint) => ({
          value: endpoint,
        })),
      }));
    if (!Object.keys(config.rootConfig.endpoints).includes(endpointName)) {
      this.error(`No such endpoint '${endpointName}'`);
    }

    let databaseName: string =
      flags.database ??
      (await this.promptDatabasePath(
        config.rootConfig.endpoints[endpointName]
      ));

    const validateStackName = (input: string) => {
      if (input.length === 0) {
        return "Stack name cannot be empty";
      } else if (
        Object.keys(config.projectConfig?.stacks ?? {}).includes(input)
      ) {
        return `Stack ${input} already exists`;
      } else {
        return true;
      }
    };

    const name =
      flags.name ??
      (await input({
        message: "Stack name",
        validate: validateStackName,
      }));
    const res = validateStackName(name);
    if (res !== true) {
      this.error(res);
    }

    const setDefault =
      flags["set-default"] ??
      (flags["non-interactive"]
        ? false
        : await confirm({
            message: "Make this stack default",
          }));

    if (setDefault) {
      config.projectConfig.defaultStack = name;
    }

    config.projectConfig.stacks[name] = {
      endpoint: endpointName,
      database: databaseName,
    };
    config.saveProjectConfig();
    console.log(`Saved stack ${name} to ${config.projectConfigFile()}`);
  }

  promptDatabasePath = async (endpoint: Endpoint): Promise<string> => {
    const { url, secret } = endpoint;
    const client = new FaunaClient({ endpoint: url, secret });

    const res = await client.query("0");
    if (res.status != 200) {
      this.error(`Error: ${res.body.error.code}`);
    }

    const databasePaths = await this.getDatabasePaths(client);

    client.close();

    return await searchSelect({
      message: "Select a database",
      choices: databasePaths.map((database) => ({
        value: database,
      })),
    });
  };

  getDatabasePaths = async (client: FaunaClient): Promise<string[]> => {
    // Limits: choose a limit of 100 databases at each depth, and a depth of 10.
    // We will also add a limit if any databases are skiped.
    const database_limit = 100;
    const depth_limit = 10;

    const allDatabases: string[] = [];
    const paths: string[][] = [[]];

    let overflowedLimit = false;
    let overflowedDepth = false;

    ux.action.start("Fetching databases");

    while (true) {
      const path = paths.pop();
      if (path === undefined) {
        break;
      }
      if (path.length > depth_limit) {
        overflowedDepth = true;
        continue;
      }

      const databases = await client.query<string[]>(
        `Database.all().take(${database_limit + 1}).toArray().map(.name)`,
        {
          secret: `${client.secret}:${path.join("/")}:admin`,
        }
      );
      if (databases.status !== 200) {
        this.error(`Error: ${databases.body.error.code}`);
      }

      if (databases.body.data.length > database_limit) {
        overflowedLimit = true;
      }

      const nested_paths = databases.body.data.map((database) => [
        ...path,
        database,
      ]);

      paths.push(...nested_paths);
      allDatabases.push(...nested_paths.map((path) => path.join("/")));
    }

    allDatabases.sort();

    ux.action.stop();

    return allDatabases;
  };
}

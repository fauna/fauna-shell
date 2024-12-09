//@ts-check
/* eslint-disable require-atomic-updates */
const __dirname = import.meta.dirname;

import * as inquirer from "@inquirer/prompts";
import fileSelector from "inquirer-file-selector";

import { container } from "../cli.mjs";
import { buildCredentials } from "../lib/auth/credentials.mjs";
import { yargsWithCommonOptions } from "../lib/command-helpers.mjs";
import { getSecret } from "../lib/fauna-client.mjs";
import { reformatFSL } from "../lib/schema.mjs";
import { listDatabasesWithAccountAPI } from "./database/list.mjs";

// TODO: handle error/exit case cleanly

async function getDatabaseRunnable(argv /*, priorChoices*/) {
  const logger = container.resolve("logger");
  const { runQueryFromString } = container.resolve("faunaClientV10");

  const result = {
    runner: async () => {}, // eslint-disable-line no-empty-function
    fql: "",
    args: {},
  };

  buildCredentials({ ...argv, user: "default", database: "us-std" });
  const dbs = (await listDatabasesWithAccountAPI(argv))
    .map((db) => `${db.region_group}/${db.name}`)
    .map((dbName) => ({ value: dbName }));

  result.args.createNewDb = await inquirer.select({
    message: "Select a database to create a project for",
    choices: [
      ...dbs,
      {
        value: "new",
        name: "New database",
      },
    ],
  });

  if (result.args.createNewDb !== "new") return result;

  logger.stdout("Ok! We'll create a new database.");

  // settings are presented in the same order as the dashboard
  // they also have the same defaults _except_ for sample data
  result.args.dbName = await inquirer.input({
    message: "Database name",
  });

  result.args.regionGroup = await inquirer.select({
    message: "Region group",
    choices: [{ value: "us-std" }, { value: "eu-std" }, { value: "global" }],
  });

  result.args.demoData = await inquirer.confirm({
    message: "Prepopulate with sample data?",
    default: true,
  });

  const otherSettings = await inquirer.checkbox({
    message: "Configure any other settings",
    choices: [
      // this could fail with role issues?
      // {
      //   name: "Backups",
      //   value: "backup",
      //   description: "Enabling this will back up your databases.",
      //   checked: false,
      // },
      // the create DB command has some thing called priority??
      {
        name: "Static typing",
        value: "typechecked",
        description:
          "Enabling this will run static analysis against the types in your queries.",
        checked: true,
      },
      {
        name: "Protected",
        value: "protected",
        description: "Enabling this will prevent destructive schema changes.",
        checked: false,
      },
    ],
  });

  result.args.backup = false;
  result.args.typechecked = false;
  result.args.protected = false;
  otherSettings.forEach((settingName) => (result.args[settingName] = true));

  buildCredentials({ ...argv, user: "default", database: "us-std" });
  result.fql = `Database.create({
  name: "${result.args.dbName}",
  protected: ${result.args.protected ?? null},
  typechecked: ${result.args.typechecked ?? null},
  priority: ${result.args.priority ?? null},
})`;

  result.runner = async ({ args, fql }) => {
    logger.stdout(`Creating database ${args.dbName}.`);
    const result = await runQueryFromString({
      expression: fql,
      secret: await getSecret(),
      url: "https://db.fauna.com",
    });

    logger.stdout(`Created database ${args.dbName}.`);
    return result;
  };

  return result;
}

async function getKeyRunnable(argv, priorChoices) {
  const { runQueryFromString } = container.resolve("faunaClientV10");
  const logger = container.resolve("logger");

  const result = {
    runner: async () => {}, // eslint-disable-line no-empty-function
    fql: "",
    args: {},
  };

  let shouldCreate = await inquirer.confirm({
    message:
      "Would you like to create a database key? These keys are used to auth requests to the database.",
    default: true,
  });

  if (!shouldCreate) return result;

  result.args.keyName = await inquirer.input({
    message: "Key name",
    default: `${priorChoices.dbName}-long-lived-key`,
  });

  result.args.role = await inquirer.select({
    message: "Role",
    choices: [
      {
        value: "admin",
        name: "Admin",
      },
      {
        value: "server",
        name: "Server",
      },
      {
        value: "server (read-only)",
        name: "Server (read-only)",
      },
    ],
  });

  // this is a little white lie - we don't actually run this FQL since we call frontdoor instead
  // but we run the equivalent of it
  // actually, do we just... run the FQL? let's just run the FQL
  result.fql = `Key.create({
  role: "${result.args.role}",
  data: {
    name: "${result.args.keyName}"
  }
})`;

  result.runner = async ({ args, fql }) => {
    logger.stdout(`Creating key ${args.dbName}.`);
    const result = await runQueryFromString({
      expression: fql,
      secret: await getSecret(),
      url: "https://db.fauna.com",
    });
    logger.stdout(`Created key ${args.dbName}.`);
    return result;
  };

  return result;
}

async function getProjectRunnable(argv, priorChoices) {
  const makeFaunaRequest = container.resolve("makeFaunaRequest");
  const logger = container.resolve("logger");

  const result = {
    runner: async () => {}, // eslint-disable-line no-empty-function
    fql: "",
    args: {},
  };

  const shouldCreateProjectDirectory = await inquirer.confirm({
    message:
      "Would you like to manage this database's schema with Fauna Schema Language (FSL)? FSL is a robust, version-controllable, and atomically updatable language for managing database schema.",
    default: true,
  });

  if (!shouldCreateProjectDirectory) return result;

  result.args.dirName = await inquirer.input({
    message: `FSL files are stored in a project directory and are specific to the database "${priorChoices.dbName}". What would you like to name this project directory?`,
    default: priorChoices.dbName,
  });

  result.args.dirPath = await fileSelector({
    message: "Where would you like the project directory to be created?",
    type: "directory",
  });

  result.runner = async ({
    args: { createNewDb, demoData, dirPath, dirName, dbName, regionGroup },
  }) => {
    const fs = container.resolve("fs");
    const fsp = container.resolve("fsp");
    const path = await import("path");
    logger.stdout(
      `Creating project directory at ${path.join(dirPath, dirName)}`,
    );

    if (!createNewDb) {
      // existing db? fetch the schema
      // TODO: this has huge overlap with schema pull - should refactor so it's only in one place
      fs.mkdirSync(path.join(dirPath, dirName), { recursive: true });
      const filesResponse = await makeFaunaRequest({
        argv: { ...argv, url: "https://db.fauna.com:443" },
        path: "/schema/1/files",
        method: "GET",
        secret: await getSecret(),
      });

      // sort for consistent order (it's nice for tests)
      const filenames = filesResponse.files
        .map((file) => file.filename)
        .filter((name) => name.endsWith(".fsl"))
        .sort();
      const writeSchemaFiles = container.resolve("writeSchemaFiles");
      const getAllSchemaFileContents = container.resolve(
        "getAllSchemaFileContents",
      );
      const contents = await getAllSchemaFileContents(filenames, {
        ...argv,
        secret: await getSecret(),
      });

      // don't start writing files until we've successfully fetched all the remote schema files
      const promises = [];
      promises.push(writeSchemaFiles(path.join(dirPath, dirName), contents));

      await Promise.all(promises);
    } else if (demoData) {
      // new db with demo data? create the demo data, then upload the schema
      await Promise.all([
        fsp.cp(
          path.join(__dirname, "../lib/schema/demo-collection-schema.fsl"),
          path.join(dirPath, dirName, "collections.fsl"),
        ),
        fsp.cp(
          path.join(__dirname, "../lib/schema/demo-function-schema.fsl"),
          path.join(dirPath, dirName, "functions.fsl"),
        ),
      ]);
      const gatherFSL = container.resolve("gatherFSL");
      const fsl = reformatFSL(await gatherFSL(path.join(dirPath, dirName)));
      const makeFaunaRequest = container.resolve("makeFaunaRequest");

      const params = new URLSearchParams({
        force: "true",
        staged: "false",
      });

      buildCredentials({
        ...argv,
        user: "default",
        database: `${regionGroup}/${dbName}`,
      });
      await makeFaunaRequest({
        argv,
        path: "/schema/1/update",
        params,
        body: fsl,
        method: "POST",
        secret: await getSecret(),
      });
    } else {
      // new db with no demo data? create two blank schema files
      await Promise.all([
        fsp.writeFile(
          path.join(__dirname, "../lib/schema/demo-collection-schema.fsl"),
          "",
        ),
        fsp.writeFile(
          path.join(__dirname, "../lib/schema/demo-function-schema.fsl"),
          "",
        ),
      ]);
    }
    logger.stdout(
      `Created project directory at ${path.join(dirPath, dirName)}`,
    );
  };

  return result;
}

async function doInit(argv) {
  // buildCredentials({ ...argv, user: "default", database: "us-std" });
  // buildCredentials({ ...argv, user: "default", database: "eu-std" });
  const runnables = [getDatabaseRunnable, getProjectRunnable, getKeyRunnable];

  let priorChoices = {};
  // gather user input
  for (const [index, runnable] of Object.entries(runnables)) {
    runnables[index] = await runnable(argv, priorChoices); // eslint-disable-line no-await-in-loop
    priorChoices = { ...priorChoices, ...runnables[index].args };
  }

  // do tasks based on user input
  for (const [index, runnable] of Object.entries(runnables)) {
    await runnable?.runner({ ...runnables[index], args: priorChoices }); // eslint-disable-line no-await-in-loop
  }
}

/**
 * @param {*} yargs
 * @returns
 */
function buildInitCommand(yargs) {
  return yargsWithCommonOptions(yargs, {}).example([]);
}

export default {
  command: "init",
  describe: "Init!!",
  builder: buildInitCommand,
  handler: doInit,
};

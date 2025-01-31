//@ts-check
/* eslint-disable require-atomic-updates */
import path from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import * as inquirer from "@inquirer/prompts";
import fileSelector from "inquirer-file-selector";

import { container } from "../cli.mjs";
import { buildCredentials } from "../lib/auth/credentials.mjs";
import { yargsWithCommonOptions } from "../lib/command-helpers.mjs";
import { getSecret } from "../lib/fauna-client.mjs";
import { reformatFSL } from "../lib/schema.mjs";
import { listDatabasesWithAccountAPI } from "./database/list.mjs";

async function doInit(argv) {
  const logger = container.resolve("logger");
  const getters = [getDatabaseRunnable, getProjectRunnable, getKeyRunnable];
  const runnables = [];

  let allChoices = {};
  // in order, gather user input (choices)
  try {
    for (const [index, getter] of Object.entries(getters)) {
      // eslint-disable-next-line no-await-in-loop
      runnables[index] = await getter(argv, allChoices);
      allChoices = { ...allChoices, ...runnables[index].choices };
    }
  } catch (e) {
    logger.stderr(
      `Failed while gathering user input. No changes have been made to the filesystem or any Fauna databases.`,
      "command",
    );
    throw e;
  }

  // in order, do tasks based on user input (choices)
  for (const runnable of runnables) {
    // eslint-disable-next-line no-await-in-loop
    await runnable?.runner({ ...runnable, choices: allChoices });
  }
}

/**
 * @param {*} yargs
 * @returns
 */
function buildInitCommand(yargs) {
  return yargsWithCommonOptions(yargs, {}).example([]);
}

async function getDatabaseRunnable(argv /*, priorChoices*/) {
  const logger = container.resolve("logger");
  const { runQueryFromString } = container.resolve("faunaClientV10");

  const runnable = {
    runner: async () => {}, // eslint-disable-line no-empty-function
    fql: "",
    choices: {},
  };

  buildCredentials({ ...argv, user: "default", database: "us-std" });
  const dbs = (await listDatabasesWithAccountAPI(argv))
    .map((db) => `${db.regionGroup}/${db.name}`)
    .map((dbName) => ({ value: dbName }));

  runnable.choices.createNewDb = await inquirer.select({
    message: "Select a database to create an FSL directory for",
    choices: [
      ...dbs,
      {
        value: "new",
        name: "New database",
      },
    ],
  });

  if (runnable.choices.createNewDb !== "new") {
    runnable.choices.dbName = runnable.choices.createNewDb.split("/")[1];
    runnable.choices.regionGroup = runnable.choices.createNewDb.split("/")[0];
    return runnable;
  }

  logger.stdout("Ok! We'll create a new database.");

  // settings are presented in the same order as the dashboard
  // they also have the same defaults _except_ for sample data
  // which is enabled by default here but not there
  runnable.choices.dbName = await inquirer.input({
    message: "Database name",
  });

  runnable.choices.regionGroup = await inquirer.select({
    message: "Region group",
    choices: [{ value: "us-std" }, { value: "eu-std" }, { value: "global" }],
  });

  runnable.choices.demoData = await inquirer.confirm({
    message: "Prepopulate with sample data?",
    default: true,
  });

  const otherSettings = await inquirer.checkbox({
    message: "Configure any other settings",
    choices: [
      // TODO: this could fail with plan / role issues? skipping.
      // {
      //   name: "Backups",
      //   value: "backup",
      //   description: "Enabling this will back up your databases.",
      //   checked: false,
      // },
      // TODO: the create DB command has some thing called priority??
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

  runnable.choices.backup = false;
  runnable.choices.typechecked = false;
  runnable.choices.protected = false;
  otherSettings.forEach(
    (settingName) => (runnable.choices[settingName] = true),
  );

  buildCredentials({
    ...argv,
    user: "default",
    database: runnable.choices.regionGroup,
  });
  runnable.fql = `Database.create({
  name: "${runnable.choices.dbName}",
  protected: ${runnable.choices.protected ?? null},
  typechecked: ${runnable.choices.typechecked ?? null},
  priority: ${runnable.choices.priority ?? null},
})`;

  runnable.runner = async ({ choices, fql }) => {
    logger.stdout(
      `Creating database ${choices.dbName} by running the following FQL query:`,
    );
    logger.stdout(fql);
    await runQueryFromString({
      expression: fql,
      secret: await getSecret(),
      url: "https://db.fauna.com",
    });

    logger.stdout(`Created database ${choices.dbName}.`);
  };

  return runnable;
}

async function getKeyRunnable(argv, priorChoices) {
  const { runQueryFromString } = container.resolve("faunaClientV10");
  const logger = container.resolve("logger");

  const runnable = {
    runner: async () => {}, // eslint-disable-line no-empty-function
    fql: "",
    choices: {},
  };

  let shouldCreate = await inquirer.confirm({
    message:
      "Would you like to create a database key? These keys are used to auth requests to the database.",
    default: true,
  });

  if (!shouldCreate) return runnable;

  runnable.choices.keyName = await inquirer.input({
    message: "Key name",
    default: `${priorChoices.dbName}-long-lived-key`,
  });

  runnable.choices.role = await inquirer.select({
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

  runnable.fql = `Key.create({
  role: "${runnable.choices.role}",
  data: {
    name: "${runnable.choices.keyName}"
  }
})`;

  runnable.runner = async ({ choices, fql }) => {
    logger.stdout(`Creating key "${choices.keyName}" by running FQL query:`);
    logger.stdout(fql);
    const response = await runQueryFromString({
      expression: fql,
      secret: await getSecret(),
      url: "https://db.fauna.com",
    });
    logger.stdout(
      `Created key "${choices.keyName}" with value "${response.data.secret}".`,
    );
  };

  return runnable;
}

async function getProjectRunnable(argv, priorChoices) {
  const makeFaunaRequest = container.resolve("makeFaunaRequest");
  const logger = container.resolve("logger");

  const runnable = {
    runner: async () => {}, // eslint-disable-line no-empty-function
    fql: "",
    choices: {},
  };

  const shouldCreateProjectDirectory = await inquirer.confirm({
    message:
      "Would you like to manage this database's schema with Fauna Schema Language (FSL)? FSL is a robust, version-controllable, and atomically updatable language for managing database schema.",
    default: true,
  });

  if (!shouldCreateProjectDirectory) return runnable;

  runnable.choices.dirName = await inquirer.input({
    message: `FSL files are stored in a directory and are specific to the database "${priorChoices.dbName}". What would you like to name this directory? In the next step, you will choose where to put the directory.`,
    default: priorChoices.dbName,
  });

  runnable.choices.dirPath = await fileSelector({
    message: "Where would you like the FSL directory to be created?",
    type: "directory",
  });

  runnable.runner = async ({ choices }) => {
    const { createNewDb, demoData, dirPath, dirName, dbName, regionGroup } =
      choices;
    const fs = container.resolve("fs");
    const fsp = container.resolve("fsp");
    const path = await import("path");
    logger.stdout(`Creating FSL directory at ${path.join(dirPath, dirName)}`);

    buildCredentials({
      ...argv,
      user: "default",
      database: `${regionGroup}/${dbName}`,
    });
    if (createNewDb !== "new") {
      // existing db? fetch the schema
      // TODO: this has huge overlap with schema pull - should refactor so it's only in one place
      fs.mkdirSync(path.join(dirPath, dirName), { recursive: true });
      const secret = await getSecret();

      const filesResponse = await makeFaunaRequest({
        argv: { ...argv, url: "https://db.fauna.com" },
        path: "/schema/1/files",
        method: "GET",
        secret,
      });

      const { version } = await makeFaunaRequest({
        argv,
        path: "/schema/1/staged/status",
        method: "GET",
        secret,
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
      const contents = await getAllSchemaFileContents(
        filenames,
        "active",
        version,
        argv,
      );

      // don't start writing files until we've successfully fetched all the remote schema files
      const promises = [];
      promises.push(writeSchemaFiles(path.join(dirPath, dirName), contents));

      await Promise.all(promises);
    } else if (demoData) {
      // new db with demo data? create the demo data, then upload the schema
      await Promise.all([
        fsp.cp(
          path.join(__dirname, "../src/lib/schema/demo-collection-schema.fsl"),
          path.join(dirPath, dirName, "collections.fsl"),
        ),
        fsp.cp(
          path.join(__dirname, "../src/lib/schema/demo-function-schema.fsl"),
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
          path.join(__dirname, "../src/lib/schema/demo-collection-schema.fsl"),
          "",
        ),
        fsp.writeFile(
          path.join(__dirname, "../src/lib/schema/demo-function-schema.fsl"),
          "",
        ),
      ]);
    }
    logger.stdout(`Created FSL directory at ${path.join(dirPath, dirName)}`);
  };

  return runnable;
}

export default {
  command: "init",
  describe:
    "Configure an existing database or create a new one. Optionally creates demo data, an FSL directory, and a database key.",
  builder: buildInitCommand,
  handler: doInit,
};

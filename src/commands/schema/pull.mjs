//@ts-check

import { container } from "../../cli.mjs";
import { yargsWithCommonQueryOptions } from "../../lib/command-helpers.mjs";
import { makeFaunaRequest } from "../../lib/db.mjs";

async function determineFileState(argv, filenames) {
  const gatherFSL = container.resolve("gatherFSL");

  // Gather local .fsl files to overwrite or delete.
  const existing = (await gatherFSL(argv.dir)).map((file) => file.name);

  // Summarize file changes.
  const adds = [];
  const overwrites = [];

  for (const fn of filenames) {
    if (existing.includes(fn)) {
      overwrites.push(fn);
    } else {
      adds.push(fn);
    }
  }
  const deletes = [];
  for (const fn of existing) {
    if (!filenames.includes(fn)) {
      deletes.push(fn);
    }
  }
  deletes.sort();

  return { adds, deletes, existing, overwrites };
}

function logDiff({ argv, adds, overwrites, deletes }) {
  const logger = container.resolve("logger");
  logger.stdout("Pull will make the following changes:");
  if (argv.delete) {
    for (const deleteme of deletes) {
      logger.stdout(`delete:    ${deleteme}`);
    }
  }
  for (const add of adds) {
    logger.stdout(`add:       ${add}`);
  }
  for (const overwrite of overwrites) {
    logger.stdout(`overwrite: ${overwrite}`);
  }
}

async function doPull(argv) {
  const logger = container.resolve("logger");
  const confirm = container.resolve("confirm");

  // fetch the list of remote FSL files
  const filesResponse = await makeFaunaRequest({
    argv,
    path: "/schema/1/files",
    method: "GET",
  });

  // sort for consistent order (it's nice for tests)
  const filenames = filesResponse.files
    .map((file) => file.filename)
    .filter((name) => name.endsWith(".fsl"))
    .sort();

  // check if there's a staged schema
  const statusResponse = await makeFaunaRequest({
    argv,
    path: "/schema/1/staged/status",
    params: new URLSearchParams({ version: filesResponse.version }),
    method: "GET",
  });

  // if there's a staged schema, cannot use the --active flag.
  // getting active FSL while staged FSL exists is not yet
  // implemented at the service level.
  if (statusResponse.status !== "none" && argv.active) {
    throw new Error(
      "There is a staged schema change. Remove the --active flag to pull it.",
    );
  } else if (statusResponse.status === "none" && !argv.active) {
    throw new Error("There are no staged schema changes to pull.");
  }

  const { adds, deletes, overwrites } = await determineFileState(
    argv,
    filenames,
  );
  logDiff({ argv, adds, deletes, overwrites });

  const confirmed = await confirm({
    message: "Accept the changes?",
    default: false,
  });

  if (confirmed) {
    const writeSchemaFiles = container.resolve("writeSchemaFiles");
    const getAllSchemaFileContents = container.resolve(
      "getAllSchemaFileContents",
    );
    const contents = await getAllSchemaFileContents(filenames, argv);

    // don't start writing or deleting files until we've successfully fetched all
    // the remote schema files
    const promises = [];
    promises.push(writeSchemaFiles(argv.dir, contents));
    if (argv.delete) {
      const deleteUnusedSchemaFiles = container.resolve(
        "deleteUnusedSchemaFiles",
      );
      promises.push(deleteUnusedSchemaFiles(argv.dir, deletes));
    }

    // process writes and deletes together async - it'll be fastest
    await Promise.all(promises);
  } else {
    logger.stdout("Change cancelled");
  }
}

function buildPullCommand(yargs) {
  return yargsWithCommonQueryOptions(yargs)
    .options({
      delete: {
        description:
          "Delete .fsl files in the target directory that are not part of the database schema",
        type: "boolean",
        default: false,
      },
      active: {
        description: "Pulls the active schema instead of the staged schema",
        type: "boolean",
        default: false,
      },
    })
    .example([
      ["$0 schema pull"],
      ["$0 schema pull --active"],
      ["$0 schema pull --delete"],
    ])
    .help("help", "Show help.");
}

export default {
  command: "pull",
  describe: "Pull a database schema's .fsl files to a local directory.",
  builder: buildPullCommand,
  handler: doPull,
};

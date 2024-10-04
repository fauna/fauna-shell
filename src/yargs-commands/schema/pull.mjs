import { container } from "../../cli.mjs";
import { commonQueryOptions } from "../../lib/command-helpers.mjs";

async function doPull(argv) {
  const logger = container.resolve("logger");
  const gatherFSL = container.resolve("gatherFSL");
  const confirm = container.resolve("confirm");
  const getSchemaFiles = container.resolve("getSchemaFiles");
  const getStagedSchemaStatus = container.resolve("getStagedSchemaStatus");
  const exit = container.resolve("exit");

  // fetch the list of remote FSL files
  const filesResponse = await getSchemaFiles();

  // check if there's a staged schema
  const statusResponse = await getStagedSchemaStatus({
    params: { version: filesResponse.version },
  });

  // if there's a staged schema, require the --staged flag.
  // getting unstaged FSL while staged FSL exists is not yet
  // implemented at the service level.
  if (statusResponse.status !== "none" && !argv.staged) {
    logger.stderr("There is a staged schema change. Use --staged to pull it.");
    exit(1);
  } else if (statusResponse.status === "none" && argv.staged) {
    logger.stderr("There are no staged schema changes to pull.");
    exit(1);
  }

  // sort for consistent order (it's nice for tests)
  const filenames = filesResponse.files
    .map((file) => file.filename)
    .filter((name) => name.endsWith(".fsl"))
    .sort();

  // Gather local .fsl files to overwrite or delete.
  const existing = await gatherFSL(argv.dir);

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

  logger.stdout("Pull makes the following changes:");
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

  const confirmed = await confirm({
    message: "Accept the changes?",
    default: false,
  });

  if (confirmed) {
    const writeSchemaFiles = container.resolve("writeSchemaFiles");
    const getAllSchemaFileContents = container.resolve(
      "getAllSchemaFileContents"
    );
    const contents = await getAllSchemaFileContents(filenames);

    // don't start writing or deleting files until we've successfully fetched all
    // the remote schema files
    const promises = [];
    promises.push(writeSchemaFiles(contents));
    if (argv.delete) {
      const deleteUnusedSchemaFiles = container.resolve(
        "deleteUnusedSchemaFiles"
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
  return yargs
    .options({
      ...commonQueryOptions,
      delete: {
        description:
          "Delete .fsl files in the target directory that are not part of the database schema",
        type: "boolean",
        default: false,
      },
      staged: {
        description: "Pulls staged schema instead of the active schema",
        type: "boolean",
        default: false,
      },
    })
    .example([
      ["$0 schema pull"],
      ["$0 schema pull --staged"],
      ["$0 schema pull --delete"],
    ])
    .version(false)
    .help("help", "show help");
}

export default {
  command: "pull",
  describe: "Pull a database schema's .fsl files into the current project",
  builder: buildPullCommand,
  handler: doPull,
};

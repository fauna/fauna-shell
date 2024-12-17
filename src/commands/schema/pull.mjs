//@ts-check

import { container } from "../../cli.mjs";
import { yargsWithCommonQueryOptions } from "../../lib/command-helpers.mjs";
import { getSecret } from "../../lib/fauna-client.mjs";
import { localSchemaOptions } from "./schema.mjs";

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

function logDiff({ argv, adds, overwrites, deletes, source }) {
  const logger = container.resolve("logger");
  logger.stdout(`Pulling ${source} schema will make the following changes:`);
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
  const makeFaunaRequest = container.resolve("makeFaunaRequest");
  const secret = await getSecret();

  // Get the staged schema status
  /** @type {{ status: "none" | "pending" | "ready" | "failed", version: string }} */
  const statusResponse = await makeFaunaRequest({
    argv,
    path: "/schema/1/staged/status",
    method: "GET",
    secret,
  });

  const version = statusResponse.version;
  const source =
    argv.active || statusResponse.status === "none" ? "active" : "staged";

  const filesParams = new URLSearchParams({
    version,
    staged: source === "staged" ? "true" : "false",
  });

  // fetch the list of remote FSL files
  const filesResponse = await makeFaunaRequest({
    argv,
    path: "/schema/1/files",
    params: filesParams,
    method: "GET",
    secret,
  });

  // sort for consistent order (it's nice for tests)
  const filenames = filesResponse.files
    .map((file) => file.filename)
    .filter((name) => name.endsWith(".fsl"))
    .sort();

  logger.debug(
    `Pulling remote ${source} schema, version '${version}'.`,
    "schema-pull",
  );

  const { adds, deletes, overwrites } = await determineFileState(
    argv,
    filenames,
  );
  logDiff({ argv, adds, deletes, overwrites, source });

  const confirmed = await confirm({
    message: "Accept the changes?",
    default: false,
  });

  if (confirmed) {
    const writeSchemaFiles = container.resolve("writeSchemaFiles");
    const getAllSchemaFileContents = container.resolve(
      "getAllSchemaFileContents",
    );
    const contents = await getAllSchemaFileContents(
      filenames,
      source,
      version,
      argv,
    );

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
    logger.stdout("Change cancelled.");
  }
}

function buildPullCommand(yargs) {
  return yargsWithCommonQueryOptions(yargs)
    .options({
      delete: {
        description:
          "Delete .fsl files in the local directory that are not part of the database schema",
        type: "boolean",
        default: false,
      },
      active: {
        description: "Pull the database's active schema files.",
        type: "boolean",
        default: false,
      },
      ...localSchemaOptions,
    })
    .example([
      [
        "$0 schema pull --database us/my_db --dir /path/to/schema/dir",
        "Pull the 'us/my_db' database's staged schema.",
      ],
      [
        "$0 schema pull --secret my-secret --dir /path/to/schema/dir",
        "Pull the staged schema for the database scoped to a secret.",
      ],
      [
        "$0 schema pull --database us/my_db --dir /path/to/schema/dir --active",
        "Pull the 'us/my_db' database's active schema.",
      ],
      [
        "$0 schema pull --database us/my_db --dir /path/to/schema/dir --delete",
        "Delete .fsl files in the local directory that are not part of the pulled schema.",
      ],
    ]);
}

export default {
  command: "pull",
  describe: "Pull a database schema's .fsl files to a local directory.",
  builder: buildPullCommand,
  handler: doPull,
};

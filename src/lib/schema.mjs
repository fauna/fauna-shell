//@ts-check

import * as path from "path";

import { container } from "../cli.mjs";
import { makeFaunaRequest } from "../lib/db.mjs";
import { ValidationError } from "./errors.mjs";
import { getSecret } from "./fauna-client.mjs";
import { dirExists, dirIsWriteable } from "./file-util.mjs";

/**
 * Pushes a schema (FSL) based on argv.
 * @param {import("yargs").Argv} yargs
 */
export async function pushSchema(argv) {
  const logger = container.resolve("logger");
  const makeFaunaRequest = container.resolve("makeFaunaRequest");
  const gatherFSL = container.resolve("gatherFSL");

  const isStagedPush = !argv.active;
  const secret = await getSecret();
  const fslFiles = await gatherFSL(argv.dir);
  const hasLocalSchema = fslFiles.length > 0;
  const absoluteDirPath = path.resolve(argv.dir);
  const fsl = reformatFSL(fslFiles);

  if (!hasLocalSchema) {
    throw new ValidationError(
      `No schema files (*.fsl) found in '${absoluteDirPath}'. Use '--dir' to specify a different directory, or create new .fsl files in this location.`,
    );
  } else if (!argv.input) {
    const params = new URLSearchParams({
      force: "true",
      staged: argv.active ? "false" : "true",
    });

    await makeFaunaRequest({
      argv,
      path: "/schema/1/update",
      params,
      body: fsl,
      method: "POST",
      secret,
    });
  } else {
    // Confirm diff, then push it.
    const params = new URLSearchParams({
      staged: argv.active ? "false" : "true",
    });

    const response = await makeFaunaRequest({
      argv,
      path: "/schema/1/diff",
      params,
      body: fsl,
      method: "POST",
      secret,
    });

    let message = isStagedPush
      ? "Stage the above changes?"
      : "Push the above changes?";
    if (response.diff) {
      logger.stdout(`Proposed diff:\n`);
      logger.stdout(response.diff);
    } else {
      logger.stdout("No logical changes.");
      message = isStagedPush
        ? "Stage the file contents anyway?"
        : "Push the file contents anyway?";
    }
    const confirm = container.resolve("confirm");
    const confirmed = await confirm({
      message,
      default: false,
    });

    if (confirmed) {
      const params = new URLSearchParams({
        version: response.version,
        staged: argv.active ? "false" : "true",
      });

      await makeFaunaRequest({
        argv,
        path: "/schema/1/update",
        params,
        body: fsl,
        method: "POST",
        secret,
      });
    } else {
      logger.stdout("Push cancelled.");
    }
  }
}

/**
 * @param {string} dir - The directory path to check for existence and write access
 */
function checkDirUsability(dir) {
  if (!dirExists(dir)) {
    throw new Error(`The project fsl directory: ${dir} does not exist.`);
  } else if (!dirIsWriteable(dir)) {
    throw new Error(`The project fsl directory: ${dir} is not writeable.`);
  }
}

/**
 * Reads files using their relative-to-`dir` paths and returns their contents
 * paired with their relative paths. Fails if the total size of the files
 * is too large.
 *
 * @param {string} dir - The path to the root directory the FSL files are stored in
 * @param {string[]} relpaths - A list of paths (relative to `dir`) to individual FSL files
 * @returns {LocalFSLFileDescription[]}
 */
function read(dir, relpaths) {
  const fs = container.resolve("fs");
  const logger = container.resolve("logger");
  const exit = container.resolve("exit");

  // database file size limit: 8mb
  const FILESIZE_LIMIT_BYTES = 8 * 1024 * 1024;
  const curr = [];
  let totalsize = 0;
  for (const relp of relpaths) {
    const fp = path.join(dir, relp);
    const content = fs.readFileSync(fp);
    totalsize += content.length;
    if (totalsize > FILESIZE_LIMIT_BYTES) {
      logger.stderr(
        `Too many bytes: tool accepts at most ${FILESIZE_LIMIT_BYTES}`,
      );
      exit(1);
    }
    curr.push({ name: relp, content: content.toString("utf8") });
  }
  return curr;
}

/**
 * Gathers all FSL files in the directory rooted at `dir` and returns a list of
 * relative paths. Fails if there are too many files.
 *
 * @param {string} dir - The path to the directory to delete unused FSL files from
 * @returns {Promise<string[]>}
 */
export async function gatherRelativeFSLFilePaths(dir) {
  const fs = container.resolve("fs");

  const FILE_LIMIT = 32000;
  // rel: string, curr: string[]
  const go = (rel, curr) => {
    const names = fs.readdirSync(path.join(dir, rel));
    const subdirs = [];
    for (const n of names) {
      const fp = path.join(dir, rel, n);
      const relp = path.join(rel, n);
      const isDir = fs.statSync(fp).isDirectory();
      if (n.endsWith(".fsl") && !isDir) {
        curr.push(relp);
      }
      if (isDir) {
        subdirs.push(relp);
      }
    }
    for (const reldir of subdirs) {
      curr.concat(go(reldir, curr));
    }
    return curr;
  };
  const files = go("", []);
  if (files.length > FILE_LIMIT) {
    throw new Error(`Too many files: ${files.length} > ${FILE_LIMIT}`);
  }
  return files;
}

/**
 * @param {string} dir - The path to the directory to delete unused FSL files from
 * @param {string[]} filesToDelete - A dictionary of filenames to their contents
 * @returns {Promise<void>}
 */
export async function deleteUnusedSchemaFiles(dir, filesToDelete) {
  const fsp = container.resolve("fsp");
  const promises = [];
  for (const fileName of filesToDelete) {
    promises.push(fsp.unlink(path.join(dir, fileName)));
  }

  await Promise.all(promises);
}

/**
 * @typedef LocalFSLFileDescription
 * @property {string} name
 * @property {string} content
 */

/**
 * @param {string} dir - The path to the directory to gather FSL files from
 * @returns {Promise<LocalFSLFileDescription[]>}
 */
export async function gatherFSL(dir) {
  const gatherRelativeFSLFilePaths = container.resolve(
    "gatherRelativeFSLFilePaths",
  );
  const logger = container.resolve("logger");

  checkDirUsability(dir);
  const fps = await gatherRelativeFSLFilePaths(dir);
  const files = read(dir, fps);
  logger.debug(
    `Looked in dir ${dir} and found files: ${JSON.stringify(files, null, 2)}`,
    "gatherFSL",
  );
  return files;
}

/**
 * @param {LocalFSLFileDescription[]} input
 * @returns {FormData}
 */
export function reformatFSL(input) {
  const fd = new FormData();
  for (const file of input) {
    fd.set(file.name, new Blob([file.content]));
  }
  return fd;
}

/**
 * @param {string} dir - The path to the directory to write FSL files to
 * @param {Record<string, string>} filenameToContentsDict - A dictionary of filenames to their contents
 * @returns {Promise<void>}
 */
export async function writeSchemaFiles(dir, filenameToContentsDict) {
  const fs = container.resolve("fs");
  const fsp = container.resolve("fsp");
  fs.mkdirSync(path.dirname(dir), { recursive: true });

  const promises = [];
  for (const [filename, fileContents] of Object.entries(
    filenameToContentsDict,
  )) {
    const fp = path.join(dir, filename);
    promises.push(fsp.writeFile(fp, fileContents));
  }

  await Promise.all(promises);
}

/** @typedef {import('./db.mjs').fetchParameters} fetchParameters */

/**
 * @param {string[]} filenames - A list of schema file names to fetch
 * @param {"active" | "staged"} source - The source to pull from
 * @param {string} version - The schema version for optimistic concurrency control
 * @param {object} argv
 * @returns {Promise<Record<string, string>>} A map of schema file names to their contents.
 */
export async function getAllSchemaFileContents(
  filenames,
  source,
  version,
  argv,
) {
  const promises = [];
  /** @type Record<string, string> */
  const fileContentCollection = {};
  const secret = await getSecret();

  const params = new URLSearchParams({
    version: version,
    staged: source === "staged" ? "true" : "false",
  });

  for (const filename of filenames) {
    promises.push(
      makeFaunaRequest({
        argv,
        path: `/schema/1/files/${encodeURIComponent(filename)}`,
        params,
        method: "GET",
        secret,
      }).then(({ content }) => {
        fileContentCollection[filename] = content;
      }),
    );
  }

  await Promise.all(promises);

  return fileContentCollection;
}

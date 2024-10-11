//@ts-check

import * as path from "path";
import { dirExists, dirIsWriteable } from "./file-util.mjs";
import { container } from "../cli.mjs";
import { makeFaunaRequest } from "../lib/db.mjs";

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
  var totalsize = 0;
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
 * @param {Omit<fetchParameters, "path"|"method">} overrides
 * @returns {Promise<Record<string, string>>} A map of schema file names to their contents.
 */
export async function getAllSchemaFileContents(filenames, { ...overrides }) {
  const promises = [];
  /** @type Record<string, string> */
  const fileContentCollection = {};
  for (const filename of filenames) {
    promises.push(
      getSchemaFile(filename, overrides).then(({ content }) => {
        fileContentCollection[filename] = content;
      }),
    );
  }

  await Promise.all(promises);

  return fileContentCollection;
}

/**
 * @param {Omit<fetchParameters, "path"|"method">} overrides
 */
export async function getSchemaFiles({ ...overrides }) {
  /** @type {fetchParameters} */
  const args = {
    ...overrides,
    path: "/schema/1/files",
    method: "GET",
  };
  return makeFaunaRequest({ ...args });
}

/**
 * @param {string} filename
 * @param {Omit<fetchParameters, "path"|"method">} overrides
 */
export async function getSchemaFile(filename, { ...overrides }) {
  /** @type {fetchParameters} */
  const args = {
    ...overrides,
    path: `/schema/1/files/${encodeURIComponent(filename)}`,
    method: "GET",
  };
  return makeFaunaRequest({ ...args });
}

/**
 * @param {Omit<fetchParameters, "path"|"method">} overrides
 */
export async function getStagedSchemaStatus({ ...overrides }) {
  /** @type {fetchParameters} */
  const args = {
    ...overrides,
    path: "/schema/1/staged/status",
    method: "GET",
  };
  return makeFaunaRequest({ ...args });
}

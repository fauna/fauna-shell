import * as fs from "fs";
import * as path from "path";
import { dirExists, dirIsWriteable } from "./file-util.mjs"
import { container } from '../cli.mjs'
import { makeFaunaRequest } from '../lib/db.mjs'

function checkDirUsability(dir) {
  if (!dirExists(dir)) {
    throw new Error(`The project fsl directory: ${dir} does not exist.`);
  } else if (!dirIsWriteable(dir)) {
    throw new Error(`The project fsl directory: ${dir} is not writeable.`);
  }
}

// Reads the files using their relative-to-`basedir` paths and returns their
// contents paired with the relative path.
// Fails if the total size of the files is too large.
// relpaths: string[]
function read(dir, relpaths) {
  const FILESIZE_LIMIT_BYTES = 32 * 1024 * 1024;
  const curr = [];
  var totalsize = 0;
  for (const relp of relpaths) {
    const fp = path.join(dir, relp);
    const content = fs.readFileSync(fp);
    totalsize += content.length;
    if (totalsize > FILESIZE_LIMIT_BYTES) {
      this.error(
        `Too many bytes: tool accepts at most ${FILESIZE_LIMIT_BYTES}`
      );
    }
    curr.push({ name: relp, content: content.toString("utf8") });
  }
  return curr;
}

// Gathers all FSL files in the directory rooted at `basedir` and returns a
// list of relative paths.
// Fails if there are too many files.
// returns string[]
export async function gatherRelativeFSLFilePaths(dir) {
  const logger = (await container.resolve("logger"))

  const FILE_LIMIT = 256;
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
    logger.stderr(`Too many files: ${files.length} > ${FILE_LIMIT}`);
  }
  return files;
}

export async function gatherFSL(dir) {
  const gatherRelativeFSLFilePaths = container.resolve("gatherRelativeFSLFilePaths")

  checkDirUsability(dir)
  const fps = await gatherRelativeFSLFilePaths(dir);
  const files = read(dir, fps);
  return JSON.stringify(files)
}

export async function getSchemaFiles({ argv, ...overrides }) {
  const args = {
    url: "/schema/1/files",
    method: "GET",
    ...overrides
  }
  return makeFaunaRequest({ argv, ...args})
}

export async function getStagedSchemaStatus({ argv, ...overrides }) {
  const args = {
    url: "/schema/1/staged/status",
    method: "GET",
    ...overrides
  }
  return makeFaunaRequest({ argv, ...args })
}

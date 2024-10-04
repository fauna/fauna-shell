import * as path from "path";
import { dirExists, dirIsWriteable } from "./file-util.mjs";
import { container } from "../cli.mjs";
import { makeFaunaRequest } from "../lib/db.mjs";
import { builtYargs } from "../cli.mjs";

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
        `Too many bytes: tool accepts at most ${FILESIZE_LIMIT_BYTES}`
      );
      exit(1);
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
  const logger = container.resolve("logger");
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
    logger.stderr(`Too many files: ${files.length} > ${FILE_LIMIT}`);
  }
  return files;
}

export async function deleteUnusedSchemaFiles(dir, filesToDelete) {
  const fs = container.resolve("fs");
  const promises = [];
  for (const fileName of filesToDelete) {
    promises.push(fs.unlink(path.join(dir, fileName)));
  }

  return Promise.all(promises);
}

export async function gatherFSL(dir) {
  const gatherRelativeFSLFilePaths = container.resolve(
    "gatherRelativeFSLFilePaths"
  );

  checkDirUsability(dir);
  const fps = await gatherRelativeFSLFilePaths(dir);
  const files = read(dir, fps);
  return JSON.stringify(files);
}

export async function writeSchemaFiles(filenameToContentsHash) {
  const fs = container.resolve("fs");
  const argv = builtYargs.argv;
  fs.mkdirSync(path.dirname(argv.dir), { recursive: true });

  const promises = [];
  for (const [filename, fileContents] of Object.entries(
    filenameToContentsHash
  )) {
    const fp = path.join(argv.dir, filename);
    promises.push(fs.writeFile(fp, fileContents));
  }

  return Promise.all(promises);
}

export async function getAllSchemaFileContents(filenames) {
  const promises = [];
  const fileContents = {};
  for (const filename of filenames) {
    promises.push(
      getSchemaFile(filename).then((fileContent) => {
        fileContents[filename] = fileContent;
      })
    );
  }

  return Promise.all(promises);
}

export async function getSchemaFiles({ ...overrides } = {}) {
  const argv = builtYargs.argv;
  const args = {
    baseUrl: argv.url,
    path: "/schema/1/files",
    method: "GET",
    ...overrides,
  };
  return makeFaunaRequest({ secret: argv.secret, ...args });
}

export async function getSchemaFile(filename, { ...overrides } = {}) {
  const argv = builtYargs.argv;
  const args = {
    baseUrl: argv.url,
    path: `/schema/1/files/${encodeURIComponent(filename)}`,
    method: "GET",
    ...overrides,
  };
  return makeFaunaRequest({ secret: argv.secret, ...args });
}

export async function getStagedSchemaStatus({ ...overrides } = {}) {
  const argv = builtYargs.argv;
  const args = {
    baseUrl: argv.url,
    path: "/schema/1/staged/status",
    method: "GET",
    ...overrides,
  };
  return makeFaunaRequest({ secret: argv.secret, ...args });
}

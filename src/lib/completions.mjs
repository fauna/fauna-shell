// @ts-check

import * as fs from "node:fs";
import * as path from "node:path";

/**
 * @typedef dirInfo
 * @type {object}
 * @property {string} path - the path to the directory
 * @property {Array<string>} childDirs - the names of the child directories of the directory at `path`
 * @property {Array<string>} childFiles - the names of the child files of the directory at `path`
 * @property {boolean} exact - whether or not this directory's path was found exactly where the user looked - did possiblePath match path exactly?
 * @property {boolean} shouldTerminate - true if the consumer should end the completion with `path.sep` instead of suggesting children
 */

/**
 * @function
 * @param {string} possiblePath - possibly a path to a directory, possibly a path ending in a partial string or gibberish. if we don't find a directory at `possiblePath`, we'll look one directory higher on the assumption that it ends in a partial string.
 * @returns {dirInfo}
 */
function getDirInfo(possiblePath) {
  /** @type dirInfo */
  let result = {
    path: "",
    childDirs: [],
    childFiles: [],
    exact: true,
    shouldTerminate: false,
  };

  try {
    // look for directories at the path
    const children = fs.readdirSync(possiblePath, { withFileTypes: true });
    children.forEach((child) => {
      if (child.isFile()) result.childFiles.push(child.name);
      if (child.isDirectory()) result.childDirs.push(child.name);
    });
    result.path = possiblePath;
    result.shouldTerminate =
      possiblePath.endsWith(path.sep) || possiblePath === "." ? false : true;
  } catch (e) {
    // if we don't find one, look up one directory
    const children = fs.readdirSync(path.dirname(possiblePath), {
      withFileTypes: true,
    });
    children.forEach((child) => {
      if (child.isFile()) result.childFiles.push(child.name);
      if (child.isDirectory()) result.childDirs.push(child.name);
    });
    result.exact = false;
    result.path = path.dirname(possiblePath);
  }
  return result;
}

export function getDirCompletions(currentWord, done) {
  done(
    getFSCompletions({
      currentWord,
      includeDirs: true,
      includeFiles: false,
    }),
  );
}

function getFSCompletions({
  currentWord,
  includeDirs = false,
  includeFiles = false,
}) {
  let dirPath = currentWord === "--dir" ? "." : currentWord;
  const dir = getDirInfo(dirPath);
  const results = [];

  if (dir.shouldTerminate) {
    // if we have an exact match without a separator, we should complete the OS specific path separator
    results.push(path.sep);
  } else if (dir.exact) {
    // exact matches ending in a separator should show all children
    if (includeDirs) results.push(...dir.childDirs);
    if (includeFiles) results.push(...dir.childFiles);
  } else {
    // non-exact matches should show all children whose names are a substring match
    if (includeDirs)
      results.push(
        ...dir.childDirs.filter((dirName) =>
          dirName.startsWith(path.basename(currentWord)),
        ),
      );
    if (includeFiles)
      results.push(
        ...dir.childFiles.filter((fileName) =>
          fileName.startsWith(currentWord),
        ),
      );
  }

  return results;
}

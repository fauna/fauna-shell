// @ts-check

import * as fs from "node:fs";
import * as path from "node:path";

function getDirs(possiblePath) {
  let result = {
    path: "",
    childDirs: [],
    exact: true,
    shouldTerminate: false,
  };
  try {
    // look for directories at the path
    result.childDirs = fs
      .readdirSync(possiblePath, { withFileTypes: true })
      .filter((ent) => ent.isDirectory())
      .map((dir) => dir.name);
    result.path = possiblePath;
    result.shouldTerminate = possiblePath.endsWith(path.sep) ? false : true;
  } catch (e) {
    // if we don't find one, look up one directory
    result.childDirs = fs
      .readdirSync(path.dirname(possiblePath), {
        withFileTypes: true,
      })
      .filter((ent) => ent.isDirectory())
      .map((dir) => dir.name);
    result.exact = false;
    result.path = path.dirname(possiblePath);
  }
  return result;
}

export function getDirCompletions(currentWord, matchValue, done) {
  // console.log("currentWord", currentWord);
  // console.log("previousWord", previousWord);
  // console.log("argv", JSON.stringify(argv, null, 2));
  // console.log("matchKey", matchKey);
  // console.log("matchValue", matchValue);
  // console.log("dirs", dirs);
  if (currentWord === "--dir") currentWord = ".";
  let dirPath = currentWord === "--dir" ? "." : matchValue;
  const dirs = getDirs(dirPath);

  if (dirs.shouldTerminate) {
    // if we have an exact match without a separator, we should complete the OS specific path separator
    done([path.sep]);
  } else if (dirs.exact) {
    // exact matches ending in a separator should show all children
    done(dirs.childDirs);
  } else {
    // non-exact matches should show all children whose names are a substring match
    done(dirs.childDirs.filter((dirName) => dirName.startsWith(currentWord)));
  }
}

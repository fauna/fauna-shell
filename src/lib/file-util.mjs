//@ts-check

import fs from "node:fs";
import { normalize } from "node:path";

// path: string, returns boolean
export function dirExists(path) {
  // TODO: needs to resolve home dir (~); node path libs won't do that for us
  const stat = fs.statSync(normalize(path), {
    // returns undefined instead of throwing if the file doesn't exist
    throwIfNoEntry: false,
  });
  if (stat === undefined || !stat.isDirectory()) {
    return false;
  } else {
    return true;
  }
}

// path: string, returns boolean
export function dirIsWriteable(path) {
  try {
    fs.accessSync(path, fs.constants.W_OK);
  } catch (e) {
    return false;
  }

  return true;
}

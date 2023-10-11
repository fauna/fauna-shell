import fs from "fs";

export function isWritableDirectory(path: string): boolean {
  const stat = fs.statSync(path, {
    // returns undefined instead of throwing if the file doesn't exist
    throwIfNoEntry: false,
  });
  if (stat === undefined || !stat.isDirectory()) {
    return false;
  }

  try {
    fs.accessSync(path, fs.constants.W_OK);
  } catch (e) {
    return false;
  }

  return true;
}

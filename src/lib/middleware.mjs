//@ts-check

import { container } from "../cli.mjs";
import { fixPath } from "../lib/file-util.mjs";

export function logArgv(argv) {
  const logger = container.resolve("logger");
  logger.debug(JSON.stringify(argv, null, 4), "argv", argv);
  return argv;
}

export function fixPaths(argv) {
  if (argv.dir) {
    return { ...argv, dir: fixPath(argv.dir) };
  } else {
    return argv;
  }
}

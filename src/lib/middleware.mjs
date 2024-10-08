//@ts-check

import { container } from "../cli.mjs";

export function logArgv(argv) {
  const logger = container.resolve("logger");
  logger.debug(JSON.stringify(argv, null, 4), "argv", argv);
  return argv;
}

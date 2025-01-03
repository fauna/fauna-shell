import { container } from "../cli.mjs";
import { Format } from "./formatting/colorize.mjs";

export function isTTY() {
  return process.stdout.isTTY;
}

export const resolveFormat = (argv) => {
  const logger = container.resolve("logger");

  if (argv.json) {
    logger.debug(
      "--json has taken precedence over other formatting options, using JSON output",
      "argv",
    );
    return Format.JSON;
  }

  return argv.format;
};

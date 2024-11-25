import yaml from "yaml";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { argvInput, builtYargs, container } from "../../cli.mjs";

/** @type {yaml.Document.Parsed<Record<string, any>>} */
export function getConfig(path) {
  const fs = container.resolve("fs");
  const fileBody = fs.readFileSync(path, { encoding: "utf8" });
  return yaml.parseDocument(fileBody);
}

export function configParser(path) {
  let parsedProfile;
  const logger = container.resolve("logger");

  logger.debug(`Reading config from ${path}...`, "config");
  const config = getConfig(path);
  const argv = yargs(hideBin(argvInput)).options({
    profile: {
      default: "default",
      type: "string",
    },
  }).argv;
  logger.debug(`Using profile ${argv.profile}...`, "config");
  parsedProfile = config.toJSON()[argv.profile];

  if (argv.profile === "default" && !parsedProfile) {
    throw new Error(
      `No "default" profile found in config file at ${path}. Either specify a profile with "--profile NAME" or add a "default" profile.`,
    );
  }

  if (!parsedProfile && argv.profile !== "default") {
    throw new Error(
      `Could not find profile "${argv.profile}" in config file at ${path}.`,
    );
  }

  logger.debug(
    `Applying config: ${JSON.stringify(parsedProfile, null, 4)}`,
    "config",
  );

  return parsedProfile;
}

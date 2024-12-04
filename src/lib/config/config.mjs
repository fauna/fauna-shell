import yaml from "yaml";
import yargs from "yargs";

import { argvInput, container } from "../../cli.mjs";
import { ValidationError } from "../command-helpers.mjs";

export const validDefaultConfigNames = [
  "fauna.config.yaml",
  "fauna.config.yml",
  "fauna.config.json",
  ".fauna.config.yaml",
  ".fauna.config.yml",
  ".fauna.config.json",
];

/** @type {yaml.Document.Parsed<Record<string, any>>} */
export function getConfig(path) {
  const fs = container.resolve("fs");
  let fileBody;
  try {
    fileBody = fs.readFileSync(path, { encoding: "utf8" });
  } catch (fsError) {
    if (fsError.code === "ENOENT") {
      throw new ValidationError(`Config file not found at path ${path}.`);
    }

    throw fsError;
  }
  return yaml.parseDocument(fileBody);
}

function checkForDefaultConfig(path) {
  const logger = container.resolve("logger");
  const fs = container.resolve("fs");

  let files = fs.readdirSync(path, { withFileTypes: true, encoding: "utf8" });
  files = files.filter(
    (file) => file.isFile() && validDefaultConfigNames.includes(file.name),
  );
  if (files.length > 1) {
    const names = files.map((file) => file.name).join(", ");
    throw new ValidationError(
      `Multiple config files found with valid default names (${names}). Either specify one with "--config FILENAME" or delete the unused config files.`,
    );
  } else if (files.length === 1) {
    logger.debug(
      `Found default config file named "${files[0].name}". Using it.`,
      "config",
    );
    return files[0].name;
  } else {
    logger.debug(`No default config file found.`, "config");
    return undefined;
  }
}

function validateConfig(profileName, profileBody, configPath) {
  if (profileName === "default" && !profileBody) {
    throw new ValidationError(
      `No "default" profile found in config file at ${configPath}. Either specify a profile with "--profile NAME" or add a "default" profile.`,
    );
  }

  if (!profileBody && profileName !== "default") {
    throw new ValidationError(
      `Could not find profile "${profileName}" in config file at ${configPath}.`,
    );
  }
}

export function configParser(path) {
  let parsedProfile;
  const logger = container.resolve("logger");

  if (path === process.cwd()) {
    path = checkForDefaultConfig(process.cwd());
  }

  if (!path) return {};

  logger.debug(`Reading config from ${path}.`, "config");
  const config = getConfig(path);
  const argv = yargs(argvInput).options({
    profile: {
      default: "default",
      alias: ["p"],
      type: "string",
    },
  }).argv;

  logger.debug(`Using profile ${argv.profile}...`, "config");
  parsedProfile = config.toJSON()[argv.profile];
  validateConfig(argv.profile, parsedProfile, path);

  logger.debug(
    `Applying config: ${JSON.stringify(parsedProfile, null, 4)}`,
    "config",
  );

  return parsedProfile;
}

import { exit } from "node:process";

import awilix from "awilix";

import { performQuery } from "../yargs-commands/eval.mjs";
import logger from "../lib/logger.mjs";
import { getSimpleClient } from "../lib/command-helpers.mjs";
import {
  gatherFSL,
  gatherRelativeFSLFilePaths,
  getAllSchemaFileContents,
  getStagedSchemaStatus,
  getSchemaFile,
  getSchemaFiles,
  deleteUnusedSchemaFiles,
  writeSchemaFiles,
} from "../lib/schema.mjs";
import { confirm } from "@inquirer/prompts";
import { makeFaunaRequest } from "../lib/db.mjs";
import fetchWrapper from "../lib/fetch-wrapper.mjs";
import { FaunaAccountClient } from "../lib/fauna-account-client.mjs";
import open from "open";
import OAuthClient from "../lib/auth/oauth-client.mjs";
import { Lifetime } from "awilix";
import fs from "node:fs";
import { AccountKey } from "../lib/file-util.mjs";
import { parseYargs } from "../cli.mjs";

// import { findUpSync } from 'find-up'
// import fs from 'node:fs'
// const __dirname = import.meta.dirname;
// export const configPath = findUpSync(['dice.json'], { cwd: __dirname })
// export const config = configPath ? JSON.parse(fs.readFileSync(configPath)) : {}

export function setupCommonContainer() {
  const container = awilix.createContainer({
    injectionMode: awilix.InjectionMode.PROXY,
    strict: true,
  });

  return container;
}

/**
 * @template T
 * @typedef {{ [P in keyof T[P]]: ReturnType<T[P]['resolve']> }} Resolvers<T>
 */

/** @typedef {Resolvers<injectables>} modifiedInjectables */
export const injectables = {
  // node libraries
  exit: awilix.asValue(exit),
  fetch: awilix.asValue(fetchWrapper),
  fs: awilix.asValue(fs),

  // third-party libraries
  confirm: awilix.asValue(confirm),
  open: awilix.asValue(open),

  // generic lib (homemade utilities)
  parseYargs: awilix.asValue(parseYargs),
  logger: awilix.asValue(logger),
  performQuery: awilix.asValue(performQuery),
  getSimpleClient: awilix.asValue(getSimpleClient),
  accountClient: awilix.asClass(FaunaAccountClient, {
    lifetime: Lifetime.SCOPED,
  }),
  oauthClient: awilix.asClass(OAuthClient, { lifetime: Lifetime.SCOPED }),
  makeFaunaRequest: awilix.asValue(makeFaunaRequest),
  accountCreds: awilix.asClass(AccountKey, { lifetime: Lifetime.SCOPED }),
  errorHandler: awilix.asValue((error, exitCode) => exit(exitCode)),

  // feature-specific lib (homemade utilities)
  gatherFSL: awilix.asValue(gatherFSL),
  gatherRelativeFSLFilePaths: awilix.asValue(gatherRelativeFSLFilePaths),
  getSchemaFile: awilix.asValue(getSchemaFile),
  getSchemaFiles: awilix.asValue(getSchemaFiles),
  writeSchemaFiles: awilix.asValue(writeSchemaFiles),
  getAllSchemaFileContents: awilix.asValue(getAllSchemaFileContents),
  getStagedSchemaStatus: awilix.asValue(getStagedSchemaStatus),
  deleteUnusedSchemaFiles: awilix.asValue(deleteUnusedSchemaFiles),
};

export function setupRealContainer() {
  /** @type {awilix.AwilixContainer<modifiedInjectables>} */
  const container = setupCommonContainer();

  container.register(injectables);

  return container;
}

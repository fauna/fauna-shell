import fs from "node:fs";
import * as fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { exit } from "node:process";

import { confirm } from "@inquirer/prompts";
import * as awilix from "awilix";
import { Lifetime } from "awilix";
import open from "open";
import updateNotifier from "update-notifier";

import { parseYargs } from "../cli.mjs";
import { performV4Query, performV10Query } from "../commands/eval.mjs";
import { makeAccountRequest } from "../lib/account.mjs";
import OAuthClient from "../lib/auth/oauth-client.mjs";
import { getSimpleClient } from "../lib/command-helpers.mjs";
import { makeFaunaRequest } from "../lib/db.mjs";
import { FaunaAccountClient } from "../lib/fauna-account-client.mjs";
import fetchWrapper from "../lib/fetch-wrapper.mjs";
import { AccountKey, SecretKey } from "../lib/file-util.mjs";
import buildLogger from "../lib/logger.mjs";
import {
  deleteUnusedSchemaFiles,
  gatherFSL,
  gatherRelativeFSLFilePaths,
  getAllSchemaFileContents,
  writeSchemaFiles,
} from "../lib/schema.mjs";

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
  // process specifics
  stdinStream: awilix.asValue(process.stdin),
  stdoutStream: awilix.asValue(process.stdout),
  stderrStream: awilix.asValue(process.stderr),

  // node libraries
  exit: awilix.asValue(exit),
  fetch: awilix.asValue(fetchWrapper),
  fs: awilix.asValue(fs),
  fsp: awilix.asValue(fsp),
  normalize: awilix.asValue(path.normalize),
  homedir: awilix.asValue(os.homedir),

  // third-party libraries
  confirm: awilix.asValue(confirm),
  open: awilix.asValue(open),
  updateNotifier: awilix.asValue(updateNotifier),

  // generic lib (homemade utilities)
  parseYargs: awilix.asValue(parseYargs),
  logger: awilix.asFunction(buildLogger),
  performV4Query: awilix.asValue(performV4Query),
  performV10Query: awilix.asValue(performV10Query),
  getSimpleClient: awilix.asValue(getSimpleClient),
  accountClient: awilix.asClass(FaunaAccountClient, {
    lifetime: Lifetime.SCOPED,
  }),
  oauthClient: awilix.asClass(OAuthClient, { lifetime: Lifetime.SCOPED }),
  makeAccountRequest: awilix.asValue(makeAccountRequest),
  makeFaunaRequest: awilix.asValue(makeFaunaRequest),
  accountCreds: awilix.asClass(AccountKey, { lifetime: Lifetime.SCOPED }),
  secretCreds: awilix.asClass(SecretKey, { lifetime: Lifetime.SCOPED }),
  errorHandler: awilix.asValue((error, exitCode) => exit(exitCode)),

  // feature-specific lib (homemade utilities)
  gatherFSL: awilix.asValue(gatherFSL),
  gatherRelativeFSLFilePaths: awilix.asValue(gatherRelativeFSLFilePaths),
  writeSchemaFiles: awilix.asValue(writeSchemaFiles),
  getAllSchemaFileContents: awilix.asValue(getAllSchemaFileContents),
  deleteUnusedSchemaFiles: awilix.asValue(deleteUnusedSchemaFiles),
};

export function setupRealContainer() {
  /** @type {awilix.AwilixContainer<modifiedInjectables>} */
  const container = setupCommonContainer();

  container.register(injectables);

  return container;
}

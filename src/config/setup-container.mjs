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
import { Credentials } from "../lib/auth/credentials.mjs";
import OAuthClient from "../lib/auth/oauth-client.mjs";
import { getSimpleClient } from "../lib/command-helpers.mjs";
import { makeFaunaRequest } from "../lib/db.mjs";
import { FaunaAccountClient } from "../lib/fauna-account-client.mjs";
import fetchWrapper from "../lib/fetch-wrapper.mjs";
import buildLogger from "../lib/logger.mjs";
import {
  deleteUnusedSchemaFiles,
  gatherFSL,
  gatherRelativeFSLFilePaths,
  getAllSchemaFileContents,
  writeSchemaFiles,
} from "../lib/schema.mjs";

export function setupCommonContainer() {
  const container = awilix.createContainer({
    injectionMode: awilix.InjectionMode.PROXY,
    strict: true,
  });

  return container;
}

/**
 * @typedef {{ [Property in keyof injectables]: ReturnType<injectables[Property]["resolve"]> }} modifiedInjectables
 */

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
  logger: awilix.asFunction(buildLogger, { lifetime: Lifetime.SINGLETON }),
  performV4Query: awilix.asValue(performV4Query),
  performV10Query: awilix.asValue(performV10Query),
  getSimpleClient: awilix.asValue(getSimpleClient),
  AccountClient: awilix.asValue(FaunaAccountClient),
  oauthClient: awilix.asClass(OAuthClient, { lifetime: Lifetime.SCOPED }),
  makeAccountRequest: awilix.asValue(makeAccountRequest),
  makeFaunaRequest: awilix.asValue(makeFaunaRequest),
  errorHandler: awilix.asValue((error, exitCode) => exit(exitCode)),

  // While we inject the class instance before this in middleware,
  //  we need to register it here to resolve types.
  credentials: awilix.asClass(Credentials, {
    lifetime: Lifetime.SINGLETON,
  }),
  accountClient: awilix.asClass(FaunaAccountClient, {
    lifetime: Lifetime.SINGLETON,
  }),

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

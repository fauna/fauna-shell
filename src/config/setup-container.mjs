import fs from "node:fs";
import * as fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { exit } from "node:process";

import { confirm } from "@inquirer/prompts";
import * as awilix from "awilix";
import { Lifetime } from "awilix";
import fauna from "fauna";
import faunadb from "faunadb";
import { colorize } from "json-colorizer";
import open from "open";
import updateNotifier from "update-notifier";

import { parseYargs } from "../cli.mjs";
import { makeAccountRequest } from "../lib/account.mjs";
import { Credentials } from "../lib/auth/credentials.mjs";
import OAuthClient from "../lib/auth/oauth-client.mjs";
import { makeRetryableFaunaRequest } from "../lib/db.mjs";
import * as faunaV10 from "../lib/fauna.mjs";
import { formatError, runQueryFromString } from "../lib/fauna-client.mjs";
import * as faunaV4 from "../lib/faunadb.mjs";
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
  dirname: awilix.asValue(path.dirname),
  normalize: awilix.asValue(path.normalize),
  homedir: awilix.asValue(os.homedir),

  // third-party libraries
  confirm: awilix.asValue(confirm),
  open: awilix.asValue(open),
  updateNotifier: awilix.asValue(updateNotifier),
  fauna: awilix.asValue(fauna),
  faunadb: awilix.asValue(faunadb),
  colorize: awilix.asValue(colorize),

  // generic lib (homemade utilities)
  parseYargs: awilix.asValue(parseYargs),
  logger: awilix.asFunction(buildLogger, { lifetime: Lifetime.SINGLETON }),
  oauthClient: awilix.asClass(OAuthClient, { lifetime: Lifetime.SCOPED }),
  makeAccountRequest: awilix.asValue(makeAccountRequest),
  makeFaunaRequest: awilix.asValue(makeRetryableFaunaRequest),
  errorHandler: awilix.asValue((_error, exitCode) => exit(exitCode)),

  // While we inject the class instance before this in middleware,
  //  we need to register it here to resolve types.
  credentials: awilix.asClass(Credentials, {
    lifetime: Lifetime.SINGLETON,
  }),
  // utilities for interacting with Fauna
  runQueryFromString: awilix.asValue(runQueryFromString),
  formatError: awilix.asValue(formatError),
  faunaClientV10: awilix.asValue(faunaV10),
  faunaClientV4: awilix.asValue(faunaV4),

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

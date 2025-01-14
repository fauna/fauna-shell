import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { PassThrough } from "node:stream";

import * as awilix from "awilix";
import { fql } from "fauna";
import { spy, stub } from "sinon";

import { f, InMemoryWritableStream } from "../../test/helpers.mjs";
import { parseYargs } from "../cli.mjs";
import { makeRetryableFaunaRequest } from "../lib/core-api.mjs";
import * as faunaClientV10 from "../lib/fauna.mjs";
import { formatQueryInfo } from "../lib/fauna-client.mjs";
import * as faunaClientV4 from "../lib/faunadb.mjs";
import buildLogger from "../lib/logger.mjs";
import { injectables, setupCommonContainer } from "./setup-container.mjs";

// Mocks all _functions_ declared on the injectables export from setup-container.mjs
function automock(container) {
  const skipped = [];
  for (const [injectableName, value] of Object.entries(injectables)) {
    if (value.isLeakSafe && typeof value.resolve() === "function") {
      container.register(injectableName, awilix.asValue(stub()));
    } else {
      skipped.push(injectableName);
    }
  }

  return skipped;
}

function confirmManualMocks(manualMocks, thingsToManuallyMock) {
  for (let i = 0; i < thingsToManuallyMock.length; i++) {
    const manualMock = manualMocks[thingsToManuallyMock[i]];
    if (!manualMock || !manualMock.resolve)
      throw new Error(
        `Please mock the injectable "${thingsToManuallyMock[i]}" by adding it to "./src/config/setup-test-container.mjs".`,
      );
  }
}

export function setupTestContainer() {
  const container = setupCommonContainer();

  const thingsToManuallyMock = automock(container);
  const customfs = stub({ ...fs });
  const customNet = stub({ ...net });
  // this is a mock used by the default profile behavior
  customfs.readdirSync.withArgs(process.cwd()).returns([]);

  const __dirname = import.meta.dirname;

  const manualMocks = {
    // process specifics
    stdinStream: awilix.asValue(new PassThrough()),
    stdoutStream: awilix.asClass(InMemoryWritableStream).singleton(),
    stderrStream: awilix.asClass(InMemoryWritableStream).singleton(),

    // wrap it in a spy so we can record calls, but use the
    // real implementation
    parseYargs: awilix.asValue(spy(parseYargs)),
    fs: awilix.asValue(customfs),
    net: awilix.asValue(customNet),
    homedir: awilix.asValue(
      stub().returns(path.join(__dirname, "../../test/test-homedir")),
    ),
    fsp: awilix.asValue({
      unlink: stub(),
      writeFile: stub(),
    }),
    updateNotifier: awilix.asValue(stub().returns({ notify: stub() })),
    fauna: awilix.asValue({
      fql: fql,
      Client: stub(),
    }),
    faunadb: awilix.asValue({
      Client: stub(),
    }),
    codeToAnsi: awilix.asValue(stub().returnsArg(0)),
    logger: awilix.asFunction((cradle) => spy(buildLogger(cradle))).singleton(),
    oauthClient: awilix.asFunction(stub()),
    docker: awilix.asValue({
      createContainer: stub(),
      getContainer: stub(),
      listContainers: stub(),
      modem: {
        followProgress: stub(),
      },
      ping: stub(),
      pull: stub(),
    }),
    credentials: awilix.asClass(stub()).singleton(),
    accountAPI: awilix.asValue({
      listDatabases: stub(),
      createKey: stub(),
      refreshSession: stub(),
      getSession: stub(),
    }),
    errorHandler: awilix.asValue((error, exitCode) => {
      error.code = exitCode;
      throw error;
    }),
    normalize: awilix.asValue(spy(path.normalize)),
    fetch: awilix.asValue(stub().resolves(f({}))),
    gatherFSL: awilix.asValue(stub().resolves([])),
    makeFaunaRequest: awilix.asValue(spy(makeRetryableFaunaRequest)),
    runQueryFromString: awilix.asValue(stub().resolves({})),
    isQueryable: awilix.asValue(stub().resolves()),
    formatError: awilix.asValue(stub()),
    formatQueryInfo: awilix.asValue(spy(formatQueryInfo)),
    faunaClientV10: awilix.asValue({
      getClient: stub(),
      runQuery: stub(),
      runQueryFromString: stub(),
      formatQueryResponse: faunaClientV10.formatQueryResponse,
      formatQueryInfo: faunaClientV10.formatQueryInfo,
      formatError: faunaClientV10.formatError,
    }),
    faunaClientV4: awilix.asValue({
      getClient: stub(),
      runQuery: stub(),
      runQueryFromString: stub(),
      formatQueryResponse: faunaClientV4.formatQueryResponse,
      formatError: faunaClientV4.formatError,
    }),
  };

  confirmManualMocks(manualMocks, thingsToManuallyMock);

  container.register(manualMocks);

  return container;
}

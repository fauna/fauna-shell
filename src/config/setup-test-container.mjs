import fs from "node:fs";
import { normalize } from "node:path";
import { PassThrough } from "node:stream";

import * as awilix from "awilix";
import { spy, stub } from "sinon";

import { f, InMemoryWritableStream } from "../../test/helpers.mjs";
import { parseYargs } from "../cli.mjs";
import { makeAccountRequest } from "../lib/account.mjs";
import { makeFaunaRequest } from "../lib/db.mjs";
import { AccountKey, SecretKey } from "../lib/file-util.mjs";
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

  const manualMocks = {
    // process specifics
    stdinStream: awilix.asValue(new PassThrough()),
    stdoutStream: awilix.asClass(InMemoryWritableStream).singleton(),
    stderrStream: awilix.asClass(InMemoryWritableStream).singleton(),

    // wrap it in a spy so we can record calls, but use the
    // real implementation
    parseYargs: awilix.asValue(spy(parseYargs)),
    fs: awilix.asValue(stub(fs)),
    fsp: awilix.asValue({
      unlink: stub(),
      writeFile: stub(),
    }),
    updateNotifier: awilix.asValue(stub().returns({ notify: stub() })),
    logger: awilix.asFunction((cradle) => spy(buildLogger(cradle))).singleton(),
    getSimpleClient: awilix.asValue(
      stub().returns({ close: () => Promise.resolve() }),
    ),
    AccountClient: awilix.asValue(() => ({ startOAuthRequest: stub(), getToken: stub(), getSession: stub() })),
    oauthClient: awilix.asFunction(stub()),
    accountCreds: awilix.asClass(AccountKey).scoped(),
    secretCreds: awilix.asClass(SecretKey).scoped(),
    // in tests, let's exit by throwing
    errorHandler: awilix.asValue((error, exitCode) => {
      error.code = exitCode;
      throw error;
    }),
    normalize: awilix.asValue(spy(normalize)),
    fetch: awilix.asValue(stub().resolves(f({}))),
    gatherFSL: awilix.asValue(stub().resolves([])),
    makeFaunaRequest: awilix.asValue(spy(makeFaunaRequest)),
    makeAccountRequest: awilix.asValue(spy(makeAccountRequest)),
  };

  confirmManualMocks(manualMocks, thingsToManuallyMock);

  container.register(manualMocks);

  return container;
}

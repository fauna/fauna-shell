import fs from "node:fs";
import { normalize } from "node:path";

import * as awilix from "awilix";
import { setupCommonContainer, injectables } from "./setup-container.mjs";
import { f } from "../../yargs-test/helpers.mjs";

import { stub, spy } from "sinon";
import { parseYargs } from "../cli.mjs";

import logger from "../lib/logger.mjs";

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
        `Please mock the injectable "${thingsToManuallyMock[i]}" by adding it to "./src/config/setup-test-container.mjs".`
      );
  }
}

export function setupTestContainer() {
  const container = setupCommonContainer();

  const thingsToManuallyMock = automock(container);

  const manualMocks = {
    // wrap it in a spy so we can record calls, but use the
    // real implementation
    parseYargs: awilix.asValue(spy(parseYargs)),
    fs: awilix.asValue(stub(fs)),
    fsp: awilix.asValue({
      unlink: stub(),
      writeFile: stub(),
    }),
    logger: awilix.asValue({
      // use these for making dev, support tickets easier.
      // they're not mocked because we shouldn't test them
      // as part of our public interface. this way, we can
      // add `--verbosity 5` to a command in a test to get
      // more output.
      debug: logger.debug,
      info: logger.info,
      warn: logger.warn,
      error: logger.error,
      fatal: logger.fatal,

      // use these for communicating with customers.
      // mocked because they _are_ part of our public
      // interface and should be tested.
      stdout: stub(),
      stderr: stub(),
    }),
    getSimpleClient: awilix.asValue(
      stub().returns({ close: () => Promise.resolve() })
    ),
    accountClient: awilix.asFunction(stub()),
    oauthClient: awilix.asFunction(stub()),
    accountCreds: awilix.asFunction(stub()),
    // in tests, let's exit by throwing
    errorHandler: awilix.asValue((error, exitCode) => {
      error.code = exitCode;
      throw error;
    }),
    normalize: awilix.asValue(spy(normalize)),
    fetch: awilix.asValue(stub().resolves(f({}))),
  };

  confirmManualMocks(manualMocks, thingsToManuallyMock);

  container.register(manualMocks);

  return container;
}

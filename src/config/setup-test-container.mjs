import * as awilix from 'awilix/lib/awilix.module.mjs'

import { setupCommonContainer, injectables } from './setup-container.mjs'
import stub from '@cloudcmd/stub'
import logger from '../lib/logger.mjs'

// Mocks all _functions_ declared on the injectables export from setup-container.mjs
function automock(container) {
  const skipped = []
  for (const [key, value] of Object.entries(injectables)) {
    if (value.isLeakSafe && typeof value.resolve() === 'function') {
      container.register({ [key]: awilix.asValue(stub()) })
    } else {
      skipped.push(key)
    }
  }

  return skipped
}

function confirmManualMocks(manualMocks, thingsToManuallyMock) {
  for (let i = 0; i < thingsToManuallyMock.length; i++) {
    const manualMock = manualMocks[thingsToManuallyMock[i]]
    if (!manualMock || !manualMock.resolve)
      throw new Error (`Please mock the injectable "${thingsToManuallyMock[i]}" by adding it to "./src/config/setup-test-container.mjs".`)
  }
}

export function setupTestContainer() {
  const container = setupCommonContainer()

  const thingsToManuallyMock = automock(container)

  const manualMocks = {
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
    getSimpleClient: awilix.asValue(stub().returns({ close: () => Promise.resolve() })),
    accountClient: awilix.asFunction(() => {
      return {
        startOAuthRequest: stub().resolves("test"),
        listDatabases: stub(),
        getSession: stub(),
        getToken: stub(),
      }
    }).scoped(),
    oauthClient: awilix.asFunction(() => {
      let handlers = {}

      return {
        start: stub(Promise.resolve().then(async () => {
          await handlers.ready();
          await handlers.auth_code_received()
        })),
        server: {
          on: (eventName, handler) => {
            handlers[eventName] = handler
          }
        }
      }
    }).scoped(),
    // in tests, let's exit by throwing
    exit: awilix.asValue(() => {
      throw new Error(1);
    })
  }

  confirmManualMocks(manualMocks, thingsToManuallyMock)

  container.register(manualMocks)

  return container
}

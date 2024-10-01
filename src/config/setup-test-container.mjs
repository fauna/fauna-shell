import * as awilix from 'awilix/lib/awilix.module.mjs'

import { setupCommonContainer } from './setup-container.mjs'
import stub from '@cloudcmd/stub'

export function setupTestContainer() {
  const container = setupCommonContainer()

  container.register({
    logger: awilix.asValue({
      // use these for making dev, support tickets easier
      debug: stub(),
      info: stub(),
      warn: stub(),
      error: stub(),
      fatal: stub(),

      // use these for communicating with customers
      stdout: stub(),
      stderr: stub(),
    }),
    performQuery: awilix.asValue(stub()),
    getSimpleClient: awilix.asValue(stub().returns({ close: () => Promise.resolve() })),
    gatherFSL: awilix.asValue(stub()),
    fetch: awilix.asValue(stub()),
  })

  return container
}

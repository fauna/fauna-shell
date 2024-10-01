import * as awilix from 'awilix/lib/awilix.module.mjs'

import { performQuery } from '../yargs-commands/eval.mjs'
import logger from '../lib/logger.mjs'
import { getSimpleClient } from '../lib/command-helpers.mjs'
import { gatherFSL } from '../lib/schema.mjs'

// import { findUpSync } from 'find-up'
// import fs from 'node:fs'
// const __dirname = import.meta.dirname;
// export const configPath = findUpSync(['dice.json'], { cwd: __dirname })
// export const config = configPath ? JSON.parse(fs.readFileSync(configPath)) : {}

export function setupCommonContainer() {
  const container = awilix.createContainer({
    injectionMode: awilix.InjectionMode.PROXY,
    strict: true
  })

  return container
}

export function setupRealContainer() {
  const container = setupCommonContainer()

  container.register({
    logger: awilix.asValue(logger),
    performQuery: awilix.asValue(performQuery),
    getSimpleClient: awilix.asValue(getSimpleClient),
    gatherFSL: awilix.asValue(gatherFSL),
    fetch: awilix.asValue(fetch),
  })

  return container
}

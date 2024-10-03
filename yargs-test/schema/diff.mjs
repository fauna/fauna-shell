import { expect } from 'chai'

import * as awilix from "awilix/lib/awilix.module.mjs";

import { f } from '../helpers.mjs'

import { run } from '../../src/cli.mjs'
import { setupTestContainer as setupContainer } from '../../src/config/setup-test-container.mjs'


describe('schema diff', function() {
  beforeEach(() => {
    container = setupContainer()
  })

  it.skip('...?', async function() {
  })
})

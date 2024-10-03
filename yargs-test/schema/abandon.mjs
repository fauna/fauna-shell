import { expect } from 'chai'

import * as awilix from "awilix/lib/awilix.module.mjs";

import { f } from '../helpers.mjs'

import { run } from '../../src/cli.mjs'
import { setupTestContainer as setupContainer } from '../../src/config/setup-test-container.mjs'


describe('schema abandon', function() {
  beforeEach(() => {
    container = setupContainer()
  })

  it.skip('can force abandon a staged schema change', async function() {
  })

  it.skip('can abandon a staged schema change', async function() {
  })

  it.skip('warns if there is no staged schema', async function() {
  })

  it.skip('can be cancelled without making mutating network calls', async function() {
  })
})

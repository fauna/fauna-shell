import { expect } from 'chai'
import { run } from '../src/cli.mjs'
import { setupTestContainer as setupContainer } from '../src/config/setup-test-container.mjs'


describe('login command', function () {
  let container;

  this.beforeEach(() => {
    container = setupContainer()
  })

  it('can login', async function () {
    await run(`login`, container);
  })
})


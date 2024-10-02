import { expect } from 'chai'
import { run } from '../src/cli.mjs'
import { setupTestContainer as setupContainer } from '../src/config/setup-test-container.mjs'


describe('login command', function () {
  let container;

  this.beforeEach(() => {
    container = setupContainer()
  })

  it('can login', async function () {
    const oauthClient = container.resolve("oauthClient")
    const logger = container.resolve("logger")
    await run(`login`, container);

    expect(container.resolve("open").calledWith("test"))

    expect(oauthClient.start.called).to.be.true
    expect(logger.stdout.calledWith("To login, open your browser to:\n test"))
  })
})


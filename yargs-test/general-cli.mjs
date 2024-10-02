import { expect } from 'chai'
import { run } from '../src/cli.mjs'
import { setupTestContainer as setupContainer } from '../src/config/setup-test-container.mjs'
import chalk from 'chalk'

describe('cli operations', function() {
  let container

  beforeEach(() => {
    container = setupContainer()
  })

  it('should exit with a helpful message if input validation fails', async function() {
    const logger = container.resolve("logger")

    // this is missing the --secret flag
    await run(`schema pull`, container)

    console.log(logger.stdout.args)
    expect(logger.stdout.called).to.be.false
    expect(logger.stderr.calledWith(chalk.red("Missing required argument: secret"))).to.be.true
    expect(logger.stderr.calledWith(chalk.redBright(/*fauna pull cmd */))).to.be.true
  })
})

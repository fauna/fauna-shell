import { expect } from 'chai'
import { run, builtYargs } from '../src/cli.mjs'
import { setupTestContainer as setupContainer } from '../src/config/setup-test-container.mjs'
import chalk from 'chalk'

describe('cli operations', function() {
  let container

  beforeEach(() => {
    container = setupContainer()
  })

  it('should exit with a helpful message if a flag is not provided', async function() {
    const logger = container.resolve("logger")

    // this is missing the --secret flag
    try {
      await run(`schema pull`, container)
    } catch (e) {}

    expect(logger.stdout.called).to.be.false
    const message = `${await builtYargs.getHelp()}\n\n${chalk.red("Missing required argument: secret")}`
    expect(logger.stderr.calledWith(message)).to.be.true
  })

  it('should exit with a helpful message if a non-existant command is provided', async function() {
    const logger = container.resolve("logger")

    // this command does not exist
    try {
      await run(`inland-empire`, container)
    } catch (e) {}

    expect(logger.stdout.called).to.be.false
    const message = `${await builtYargs.getHelp()}\n\n${chalk.red("Unknown argument: inland-empire")}`
    expect(logger.stderr.calledWith(message)).to.be.true
  })

  it('should exit with a helpful message if the handler throws', async function() {
    const logger = container.resolve("logger")

    // this hidden command's handler always throws
    try {
      await run(`throw`, container)
    } catch (e) {}

    expect(logger.stdout.called).to.be.false
    const message = `${await builtYargs.getHelp()}\n\n${chalk.red("this is a test error")}`
    expect(logger.stderr.calledWith(message)).to.be.true
  })

  it('should exit with a helpful message if the handler returns a rejected promise', async function() {
    const logger = container.resolve("logger")

    // this hidden command's handler always returns a rejected promise
    try {
      await run(`reject`, container)
    } catch (e) {}

    expect(logger.stdout.called).to.be.false
    const message = `${await builtYargs.getHelp()}\n\n${chalk.red("this is a rejected promise")}`
    expect(logger.stderr.calledWith(message)).to.be.true
  })
})

import chalk from 'chalk'
import { builtYargs } from '../cli.mjs'

function log(text, verbosity, stream, component="unknown", formatter) {
  const argv = builtYargs.argv
  if (argv.verbosity >= verbosity || argv.verboseComponent.includes(component)) {
    const prefix = /^(\n*)(.*)$/gm.exec(text)[1]
    const strippedText = /^(\n*)(.*)$/gm.exec(text)[2]
    stream(`${prefix}[${formatter(component)}]: ${formatter(strippedText)}`)
  }
}

const logger = {
  // use these for making dev, support tickets easier
  debug: (text, component) => log(text, 5, console.log, component, chalk.blue),
  info: (text, component) => log(text, 4, console.log, component, chalk.green),
  warn: (text, component) => log(text, 3, console.warn, component, chalk.yellow),
  error: (text, component) => log(text, 2, console.error, component, chalk.red),
  fatal: (text, component) => log(text, 1, console.error, component, chalk.redBright),

  // use these for communicating with customers
  stdout: console.log,
  stderr: console.error,
}

export default logger

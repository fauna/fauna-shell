import chalk from 'chalk'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

function log(text, verbosity, stream, component="unknown", formatter) {
  const argv = yargs(hideBin(process.argv))
  // this is a huge hack... providing this allows argv to parse w/defaults
  // need a better option
    .options({
      "verbosity": {
        type: 'number',
        default: 0
      },
      "verbose-component": {
        type: 'array',
        default: [],
        choices: ['fetch'],
      },
    })
    .argv
  if (argv.verbosity >= verbosity || argv.verboseComponent.includes(component))
    stream(`[${formatter(component)}]: ${formatter(text)}`)
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

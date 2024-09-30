import chalk from 'chalk'

function log(text, verbosity, stream, component="unknown") {
  if (config.verbosity >= verbosity)
    stream(`[${component}]: ${text}`)
}

const logger = {
  // use these for making dev, support tickets easier
  debug: (text, component) => log(chalk.blue(text), 5, console.log, component),
  info: (text, component) => log(chalk.green(text), 4, console.log, component),
  warn: (text, component) => log(chalk.yellow(text), 3, console.warn, component),
  error: (text, component) => log(chalk.red(text), 2, console.error, component),
  fatal: (text, component) => log(chalk.redBright(text), 1, console.error, component),

  // use these for communicating with customers
  stdout: console.log,
  stderr: console.error,
}

export default logger

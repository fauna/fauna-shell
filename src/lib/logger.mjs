import chalk from "chalk";
import { builtYargs } from "../cli.mjs";

export function log(
  text,
  verbosity,
  stream,
  component = "unknown",
  formatter,
  argv
) {
  if (!argv) {
    argv = builtYargs.argv;
  }

  if (
    !argv.then &&
    (argv.verbosity >= verbosity || argv.verboseComponent.includes(component))
  ) {
    // fails on intentional multi-line output
    // demo with `--verbose-component argv`
    // const prefix = /^(\n*)(.*)$/gm.exec(text)[1]
    // const strippedText = /^(\n*)(.*)$/gm.exec(text)[2]
    // stream(`${prefix}[${formatter(component)}]: ${formatter(strippedText)}`)
    stream(`[${formatter(component)}]: ${formatter(text)}`);
  }
}

const logger = {
  // use these for making dev, support tickets easier
  debug: (text, component, argv) =>
    log(text, 5, console.log, component, chalk.blue, argv),
  info: (text, component, argv) =>
    log(text, 4, console.log, component, chalk.green, argv),
  warn: (text, component, argv) =>
    log(text, 3, console.warn, component, chalk.yellow, argv),
  error: (text, component, argv) =>
    log(text, 2, console.error, component, chalk.red, argv),
  fatal: (text, component, argv) =>
    log(text, 1, console.error, component, chalk.redBright, argv),

  // use these for communicating with customers
  stdout: console.log,
  stderr: console.error,
};

export default logger;

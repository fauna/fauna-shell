import chalk from "chalk";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

/**
 * @typedef argv
 * @type {object}
 * @property {Array.<string>} verboseComponent - An array of components to always log information about, regardless of the current verbosity level.
 * @property {number} verbosity - The highest (least critical) log line to emit, ranging from 4 (debug) to 1 (fatal). Logs above the verbosity level are not emitted.
 */

/**
 * Runs the function in the context of a database connection.
 *
 * @function
 * @param {Object} args
 * @param {string} args.text - The text to log.
 * @param {number} args.verbosity - The verbosity level for the log line, ranging from 4 (debug) to 1 (fatal). Used to determine the color of the logged text as well as whether or not to emit the log line (and if so, to which stream).
 * @param {function} args.stream - A function that handles a log line. Typically `console.log` or `console.error`, but could be any function that takes string input.
 * @param {string} [args.component] - A string that identifies what "component" of the application this is. Included in the log line as a prefix and also used for formatting with verboseComponents
 * @param {function} [args.formatter] - A function that takes a string and decorates it. Usually used to provide color for the log line.
 * @param {argv} [args.argv] - The parsed yargs argv. Used to determine the current verbosity and if any components are included in verboseComponents.
 */
export function log({
  text,
  verbosity,
  stream,
  component = "unknown",
  formatter = (text) => text,
  argv,
}) {
  // stringified errors come with this prefix; since we're going to add a component
  // tag (usually "[error]") to the front anyways, let's strip this prefix
  text = text.replace(/^Error: /, "");

  // this case only occurs when an error is thrown and not caught
  if (!argv) {
    // we give yargs _just_ enough information that we can use it to parse
    // out the verbosity flags needed by the logger
    argv = yargs(hideBin(process.argv))
      .options({
        verboseComponent: {
          type: "array",
          default: [],
        },
        verbosity: {
          type: "number",
          default: 0,
        },
      })
      .version(false).argv;
  }

  if (
    argv.verbosity >= verbosity ||
    argv.verboseComponent.includes(component)
  ) {
    const prefix = chalk.reset("[") + formatter(component) + chalk.reset("]: ");
    stream(prefix + formatter(text));
    return true;
  }
  return false;
}

/**
 * Log text at a debug log level (verbosity 5).
 *
 * @function
 * @param {string} text - The text to log.
 * @param {string} [component] - A string that identifies what "component" of the application this is. Included in the log line as a prefix and also used for formatting with verboseComponents
 * @param {argv} [argv] - The parsed yargs argv. Used to determine the current verbosity and if any components are included in verboseComponents.
 */
function debug(text, component, argv) {
  log({
    text,
    verbosity: 5,
    stream: console.log,
    component,
    formatter: chalk.blue,
    argv,
  });
}

/**
 * Log text at a info log level (verbosity 4).
 *
 * @function
 * @param {string} text - The text to log.
 * @param {string} [component] - A string that identifies what "component" of the application this is. Included in the log line as a prefix and also used for formatting with verboseComponents
 * @param {argv} [argv] - The parsed yargs argv. Used to determine the current verbosity and if any components are included in verboseComponents.
 */
function info(text, component, argv) {
  log({
    text,
    verbosity: 4,
    stream: console.log,
    component,
    formatter: chalk.green,
    argv,
  });
}

/**
 * Log text at a warn log level (verbosity 3).
 *
 * @function
 * @param {string} text - The text to log.
 * @param {string} [component] - A string that identifies what "component" of the application this is. Included in the log line as a prefix and also used for formatting with verboseComponents
 * @param {argv} [argv] - The parsed yargs argv. Used to determine the current verbosity and if any components are included in verboseComponents.
 */
function warn(text, component, argv) {
  log({
    text,
    verbosity: 3,
    stream: console.warn,
    component,
    formatter: chalk.yellow,
    argv,
  });
}

/**
 * Log text at a error log level (verbosity 2).
 *
 * @function
 * @param {string} text - The text to log.
 * @param {string} [component] - A string that identifies what "component" of the application this is. Included in the log line as a prefix and also used for formatting with verboseComponents
 * @param {argv} [argv] - The parsed yargs argv. Used to determine the current verbosity and if any components are included in verboseComponents.
 */
function error(text, component, argv) {
  log({
    text,
    verbosity: 2,
    stream: console.error,
    component,
    formatter: chalk.red,
    argv,
  });
}

/**
 * Log text at a fatal log level (verbosity 1).
 *
 * @function
 * @param {string} text - The text to log.
 * @param {string} [component] - A string that identifies what "component" of the application this is. Included in the log line as a prefix and also used for formatting with verboseComponents
 * @param {argv} [argv] - The parsed yargs argv. Used to determine the current verbosity and if any components are included in verboseComponents.
 */
function fatal(text, component, argv) {
  log({
    text,
    verbosity: 1,
    stream: console.error,
    component,
    formatter: chalk.redBright,
    argv,
  });
}

const logger = {
  // use these for making dev, support tickets easier
  debug,
  info,
  warn,
  error,
  fatal,

  // use these for communicating with customers
  stdout: console.log,
  stderr: console.error,
};

export default logger;

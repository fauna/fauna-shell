import chalk from "chalk";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

export function log({
  text,
  verbosity,
  stream,
  component = "unknown",
  formatter,
  argv,
}) {
  // stringified errors come with this prefix; since we're going to add a component
  // tag (usually "[error]") to the front anyways, let's strip this prefix
  text = text.replace(/^Error: /, "");

  // this case only occurs when an error is thrown and not caught
  if (!argv) {
    // we give yargs _just_ enough information that we can use it to parse
    // out the verbosity flags needed by the logger
    argv = yargs(hideBin(process.argv)).options({
      verboseComponent: {
        type: "array",
        default: [],
      },
      verbosity: {
        type: "number",
        default: 0,
      },
    }).argv;
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
